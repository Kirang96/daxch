from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from sqlalchemy.orm import Session

from backend.app.models.entities import (
    AgentDecision,
    AgentStatus,
    BrokerConnection,
    ConfirmationStatus,
    DecisionType,
    MonitorAgent,
    NotificationType,
    Order,
    OrderStatus,
    StockHolding,
    User,
)
from backend.app.schemas.agent import OrderSnapshot
from backend.app.schemas.stock import StockCreateRequest, StockResponse
from backend.app.services.audit import log_event
from backend.app.services.broker.factory import get_broker
from backend.app.services.broker.order_execution import OrderPlacementError, place_and_sync_order
from backend.app.services.entry_fill import activate_agent_after_entry_fill, agent_awaiting_entry_fill
from backend.app.services.notification_events import create_notification_event
from backend.app.services.plan_limits import get_agent_limit, get_max_polling_frequency
from backend.app.services.positions.order_sync import is_order_fully_filled


def _check_duplicate_entry(db: Session, user_id: UUID, ticker: str) -> None:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(seconds=30)
    stmt = (
        select(StockHolding)
        .where(
            StockHolding.user_id == user_id,
            StockHolding.ticker == ticker.upper(),
            StockHolding.bought_at >= cutoff,
        )
        .limit(1)
    )
    if db.execute(stmt).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A holding for {ticker.upper()} was created recently. Please wait before retrying.",
        )


def _validate_entry_preconditions(payload: StockCreateRequest) -> None:
    if payload.entry_price <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Entry price must be positive.")
    if payload.quantity < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity must be at least 1.")

    snapshot = payload.analysis_snapshot or {}
    if snapshot.get("decision_type") == "dont_enter" and not payload.force_entry:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Strategy analysis recommends not entering. Choose a different strategy or adjust your plan.",
        )


async def activate_with_entry_order(
    db: Session,
    current_user: User,
    payload: StockCreateRequest,
) -> StockResponse:
    _validate_entry_preconditions(payload)
    _check_duplicate_entry(db, current_user.id, payload.ticker)

    broker = get_broker("upstox")
    if broker._demo_mode:  # noqa: SLF001
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Real broker orders are disabled in demo mode. Connect Upstox credentials to place orders.",
        )

    connection = db.execute(
        select(BrokerConnection).where(BrokerConnection.user_id == current_user.id)
    ).scalar_one_or_none()
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Connect your Upstox account before placing an entry order.",
        )

    agent_limit = get_agent_limit(current_user.plan_tier.value)
    if agent_limit is not None:
        count_stmt = select(MonitorAgent).join(StockHolding, MonitorAgent.holding_id == StockHolding.id).where(
            StockHolding.user_id == current_user.id
        )
        active_agents = len(db.execute(count_stmt).scalars().all())
        if active_agents >= agent_limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Starter plan allows up to {agent_limit} agents.",
            )

    holding = StockHolding(
        user_id=current_user.id,
        ticker=payload.ticker.upper(),
        exchange=payload.exchange.upper(),
        entry_price=payload.entry_price,
        quantity=payload.quantity,
        intention=payload.intention,
    )
    db.add(holding)
    db.flush()

    max_freq = get_max_polling_frequency(current_user.plan_tier.value)
    frequency = payload.polling_frequency
    if max_freq <= 2:
        frequency = 2
    else:
        frequency = max(2, min(max_freq, frequency))

    snapshot = payload.analysis_snapshot or {}
    reasoning = snapshot.get("reasoning") or f"Initial LIMIT entry at ₹{payload.entry_price:.2f}"

    agent = MonitorAgent(
        holding_id=holding.id,
        polling_frequency=frequency,
        status=AgentStatus.paused,
        next_poll_at=None,
        agent_config={
            "auto_execute_on_timeout": False,
            "confirmation_timeout_minutes": 5,
            "awaiting_entry_fill": True,
            "analysis_strategy": payload.analysis_strategy,
            "entry_source": payload.entry_source,
        },
    )
    db.add(agent)
    db.flush()

    decision = AgentDecision(
        agent_id=agent.id,
        decision_type=DecisionType.initial_entry,
        reasoning=reasoning,
        analysis_data={
            **snapshot,
            "entry_source": payload.entry_source,
            "analysis_strategy": payload.analysis_strategy,
            "planned_entry_price": payload.entry_price,
            "planned_quantity": payload.quantity,
        },
        confirmation_status=ConfirmationStatus.approved,
        confirmed_at=datetime.now(tz=timezone.utc),
    )
    db.add(decision)
    db.flush()

    order = Order(
        decision_id=decision.id,
        order_type="LIMIT",
        status=OrderStatus.pending,
        price=payload.entry_price,
        quantity=payload.quantity,
        transaction_type="BUY",
    )
    db.add(order)
    db.flush()

    agent.agent_config = {
        **agent.agent_config,
        "entry_decision_id": str(decision.id),
        "entry_order_id": str(order.id),
    }

    placement_error: str | None = None
    try:
        await place_and_sync_order(
            db,
            current_user,
            holding,
            order,
            order_type="LIMIT",
            transaction_type="BUY",
            price=payload.entry_price,
        )
        log_event(
            db,
            agent.id,
            "entry_order_placed",
            {
                "decision_id": str(decision.id),
                "order_id": str(order.id),
                "broker_order_id": order.broker_order_id,
                "price": payload.entry_price,
                "quantity": payload.quantity,
            },
        )
        create_notification_event(
            db,
            current_user.id,
            NotificationType.agent,
            f"{holding.ticker}: entry order placed",
            f"LIMIT buy for {payload.quantity} shares at ₹{payload.entry_price:.2f} sent to Upstox.",
            {"decision_id": str(decision.id), "order_id": str(order.id), "ticker": holding.ticker},
        )
        if is_order_fully_filled(order):
            activate_agent_after_entry_fill(db, agent, holding, order)
    except OrderPlacementError as exc:
        placement_error = str(exc)
        order.status = OrderStatus.failed
        log_event(
            db,
            agent.id,
            "entry_order_failed",
            {"decision_id": str(decision.id), "order_id": str(order.id), "error": placement_error},
        )

    db.commit()
    db.refresh(holding)
    db.refresh(agent)
    db.refresh(order)

    response = StockResponse.model_validate(holding)
    response.agent_id = agent.id
    response.agent_status = agent.status.value
    response.awaiting_entry_fill = bool(agent.agent_config.get("awaiting_entry_fill"))
    response.entry_order = OrderSnapshot.model_validate(order)
    return response


# Re-export for API consumers
__all__ = ["activate_with_entry_order", "agent_awaiting_entry_fill"]
