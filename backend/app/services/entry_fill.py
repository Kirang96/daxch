from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.app.models.entities import AgentStatus, MonitorAgent, NotificationType, Order, StockHolding
from backend.app.services.audit import log_event
from backend.app.services.notification_events import create_notification_event
from backend.app.services.positions.order_sync import apply_entry_fill_to_holding


def agent_awaiting_entry_fill(agent: MonitorAgent) -> bool:
    return bool((agent.agent_config or {}).get("awaiting_entry_fill"))


def activate_agent_after_entry_fill(
    db: Session,
    agent: MonitorAgent,
    holding: StockHolding,
    order: Order,
) -> None:
    from backend.app.agents.scheduler import _next_poll_time

    apply_entry_fill_to_holding(holding, order)
    config = dict(agent.agent_config or {})
    config["awaiting_entry_fill"] = False
    agent.agent_config = config
    agent.status = AgentStatus.active
    agent.next_poll_at = _next_poll_time(agent.polling_frequency, now=datetime.now(tz=timezone.utc))
    log_event(
        db,
        agent.id,
        "entry_filled",
        {
            "order_id": str(order.id),
            "filled_quantity": order.filled_quantity,
            "average_price": order.average_price,
            "ticker": holding.ticker,
        },
    )
    create_notification_event(
        db,
        holding.user_id,
        NotificationType.agent,
        f"{holding.ticker}: entry filled — monitoring active",
        "Your limit order filled. The agent will now monitor on schedule.",
        {"order_id": str(order.id), "ticker": holding.ticker, "agent_id": str(agent.id)},
    )
