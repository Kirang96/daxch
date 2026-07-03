"""Sync agent state when an entry order reaches a terminal broker status."""

from sqlalchemy.orm import Session

from backend.app.models.entities import AgentStatus, MonitorAgent, NotificationType, Order, OrderStatus, StockHolding
from backend.app.services.audit import log_event
from backend.app.services.broker.base import OrderStatusResponse
from backend.app.services.entry_fill import activate_agent_after_entry_fill, agent_awaiting_entry_fill
from backend.app.services.notification_events import create_notification_event
from backend.app.services.positions.order_sync import is_order_fully_filled, is_order_terminal, sync_order_from_broker_status


def apply_entry_order_broker_status(
    db: Session,
    *,
    agent: MonitorAgent,
    holding: StockHolding,
    order: Order,
    live: OrderStatusResponse,
    notify: bool = True,
) -> None:
    """Update order + agent config after syncing live broker status for an entry order."""
    if not agent_awaiting_entry_fill(agent):
        sync_order_from_broker_status(order, live)
        return

    sync_order_from_broker_status(order, live)
    broker_status = (live.status or "").lower()

    if is_order_fully_filled(order):
        activate_agent_after_entry_fill(db, agent, holding, order)
        return

    if is_order_terminal(order) and order.status == OrderStatus.cancelled:
        config = dict(agent.agent_config or {})
        config["awaiting_entry_fill"] = False
        agent.agent_config = config
        agent.status = AgentStatus.stopped
        if notify:
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.agent,
                f"{holding.ticker}: entry order cancelled",
                "Your limit entry order was cancelled. The agent has been stopped.",
                {"order_id": str(order.id), "ticker": holding.ticker},
            )
        return

    if broker_status in ("rejected", "failed"):
        order.status = OrderStatus.failed
        config = dict(agent.agent_config or {})
        config["awaiting_entry_fill"] = False
        config["entry_order_error"] = live.message or f"Order {broker_status} by exchange"
        agent.agent_config = config
        agent.status = AgentStatus.paused
        log_event(
            db,
            agent.id,
            "entry_order_failed",
            {"order_id": str(order.id), "broker_status": live.status, "message": live.message},
        )
        if notify:
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.agent,
                f"{holding.ticker}: entry order rejected",
                live.message or "Your limit entry order was rejected by the exchange.",
                {"order_id": str(order.id), "ticker": holding.ticker},
            )
    elif broker_status in ("cancelled", "canceled"):
        order.status = OrderStatus.cancelled
        config = dict(agent.agent_config or {})
        config["awaiting_entry_fill"] = False
        agent.agent_config = config
        agent.status = AgentStatus.stopped
        if notify:
            create_notification_event(
                db,
                holding.user_id,
                NotificationType.agent,
                f"{holding.ticker}: entry order cancelled",
                "Your limit entry order was cancelled. The agent has been stopped.",
                {"order_id": str(order.id), "ticker": holding.ticker},
            )
