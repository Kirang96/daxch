from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.agents.scheduler import _next_poll_time
from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import (
    AgentDecision,
    AgentStatus,
    AuditLog,
    ConfirmationStatus,
    DecisionType,
    MonitorAgent,
    NotificationType,
    Order,
    OrderStatus,
    StockHolding,
    User,
)
from backend.app.schemas.agent import (
    AgentCreateRequest,
    AgentDetailResponse,
    AgentHoldingSnapshot,
    AgentResponse,
    DecisionResponse,
    OrderSnapshot,
    SquareOffRequest,
)
from backend.app.services.audit import log_event
from backend.app.services.broker.factory import get_broker
from backend.app.services.broker.order_execution import OrderPlacementError, place_and_sync_order
from backend.app.services.broker.upstox import BrokerConfigurationError
from backend.app.services.entry_fill import agent_awaiting_entry_fill
from backend.app.services.notification_events import create_notification_event
from backend.app.services.plan_limits import get_agent_limit, get_max_polling_frequency
from backend.app.services.positions.exchange import aggregate_exchange_positions
from backend.app.services.subscription_access import require_platform_access

router = APIRouter(prefix="/agents", tags=["agents"])


def _agent_response(agent: MonitorAgent) -> AgentResponse:
    resp = AgentResponse.model_validate(agent)
    resp.awaiting_entry_fill = agent_awaiting_entry_fill(agent)
    return resp


@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: AgentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AgentResponse:
    require_platform_access(db, current_user)
    holding = db.get(StockHolding, payload.holding_id)
    if not holding or holding.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")

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

    max_freq = get_max_polling_frequency(current_user.plan_tier.value)
    if max_freq <= 2:
        payload.polling_frequency = 2
    else:
        payload.polling_frequency = max(2, min(max_freq, payload.polling_frequency))

    existing = db.execute(select(MonitorAgent).where(MonitorAgent.holding_id == holding.id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Agent already exists for this holding")

    agent = MonitorAgent(
        holding_id=holding.id,
        polling_frequency=payload.polling_frequency,
        next_poll_at=_next_poll_time(payload.polling_frequency, now=datetime.now(tz=timezone.utc)),
        agent_config={
            "auto_execute_on_timeout": False,
            "confirmation_timeout_minutes": payload.confirmation_timeout_minutes,
        },
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return _agent_response(agent)


@router.get("", response_model=list[AgentResponse])
def list_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AgentResponse]:
    stmt = (
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(StockHolding.user_id == current_user.id)
    )
    agents = db.execute(stmt).scalars().all()
    return [_agent_response(a) for a in agents]


@router.get("/{agent_id}", response_model=AgentDetailResponse)
def get_agent_detail(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AgentDetailResponse:
    stmt = (
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(MonitorAgent.id == UUID(agent_id), StockHolding.user_id == current_user.id)
    )
    agent = db.execute(stmt).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    holding = db.get(StockHolding, agent.holding_id)
    if not holding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")

    decisions_stmt = (
        select(AgentDecision)
        .options(selectinload(AgentDecision.order))
        .where(AgentDecision.agent_id == agent.id)
        .order_by(AgentDecision.decided_at.desc())
        .limit(50)
    )
    decisions = db.execute(decisions_stmt).scalars().all()

    audit_stmt = (
        select(AuditLog)
        .where(AuditLog.agent_id == agent.id)
        .order_by(AuditLog.created_at.desc())
        .limit(50)
    )
    audits = db.execute(audit_stmt).scalars().all()
    recent_audit = [
        {"event_type": audit.event_type, "payload": audit.payload, "created_at": audit.created_at.isoformat()}
        for audit in audits
    ]

    def _build_decision(d: AgentDecision) -> DecisionResponse:
        resp = DecisionResponse.model_validate(d)
        if d.order:
            resp.order = OrderSnapshot.model_validate(d.order)
        return resp

    return AgentDetailResponse(
        agent=_agent_response(agent),
        holding=AgentHoldingSnapshot.model_validate(holding),
        decisions=[_build_decision(d) for d in decisions],
        recent_audit=recent_audit,
    )


@router.get("/{agent_id}/decisions", response_model=list[DecisionResponse])
def list_agent_decisions(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DecisionResponse]:
    stmt = (
        select(AgentDecision)
        .options(selectinload(AgentDecision.order))
        .join(MonitorAgent, AgentDecision.agent_id == MonitorAgent.id)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(MonitorAgent.id == UUID(agent_id), StockHolding.user_id == current_user.id)
        .order_by(AgentDecision.decided_at.desc())
    )
    decisions = db.execute(stmt).scalars().all()

    def _build_decision(d: AgentDecision) -> DecisionResponse:
        resp = DecisionResponse.model_validate(d)
        if d.order:
            resp.order = OrderSnapshot.model_validate(d.order)
        return resp

    return [_build_decision(d) for d in decisions]


@router.post("/decisions/{decision_id}/confirm")
async def confirm_decision(
    decision_id: str,
    approve: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    stmt = (
        select(AgentDecision)
        .join(MonitorAgent, AgentDecision.agent_id == MonitorAgent.id)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(AgentDecision.id == UUID(decision_id), StockHolding.user_id == current_user.id)
    )
    decision = db.execute(stmt).scalar_one_or_none()
    if not decision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

    decision.confirmation_status = ConfirmationStatus.approved if approve else ConfirmationStatus.rejected
    decision.confirmed_at = datetime.now(tz=timezone.utc)

    agent = db.get(MonitorAgent, decision.agent_id)
    holding = db.get(StockHolding, agent.holding_id) if agent else None
    order = db.execute(select(Order).where(Order.decision_id == decision.id)).scalar_one_or_none()

    if approve and agent and holding and decision.decision_type not in (DecisionType.hold, DecisionType.initial_entry) and order:
        tx_type = "BUY" if decision.decision_type == DecisionType.buy_more else "SELL"
        try:
            await place_and_sync_order(
                db,
                current_user,
                holding,
                order,
                order_type="MARKET",
                transaction_type=tx_type,
                price=order.price,
            )
        except OrderPlacementError:
            order.status = OrderStatus.failed

    if agent:
        log_event(
            db,
            agent.id,
            "decision_confirmed",
            {"decision_id": str(decision.id), "approved": approve, "status": decision.confirmation_status.value},
        )
    if holding:
        create_notification_event(
            db,
            holding.user_id,
            NotificationType.agent,
            f"{holding.ticker}: decision {'approved' if approve else 'rejected'}",
            "Your confirmation was recorded for the latest agent suggestion.",
            {"decision_id": str(decision.id), "approved": approve},
        )

    db.commit()
    return {"updated": True, "confirmation_status": decision.confirmation_status.value}


@router.post("/{agent_id}/entry-order/cancel")
async def cancel_entry_order(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    stmt = (
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(MonitorAgent.id == UUID(agent_id), StockHolding.user_id == current_user.id)
    )
    agent = db.execute(stmt).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if not agent_awaiting_entry_fill(agent):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent is not awaiting an entry fill.")

    config = agent.agent_config or {}
    order_id = config.get("entry_order_id")
    decision_id = config.get("entry_decision_id")
    order = db.get(Order, UUID(order_id)) if order_id else None
    if not order and decision_id:
        order = db.execute(select(Order).where(Order.decision_id == UUID(decision_id))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry order not found.")

    holding = db.get(StockHolding, agent.holding_id)
    if order.broker_order_id and holding:
        broker = get_broker("upstox")
        try:
            from backend.app.services.broker.session import get_valid_broker_token

            _, token = await get_valid_broker_token(db=db, user=current_user, broker=broker)
            if hasattr(broker, "cancel_order"):
                await broker.cancel_order(order.broker_order_id, token)
        except (BrokerConfigurationError, OrderPlacementError):
            pass

    order.status = OrderStatus.cancelled
    order.broker_status = "cancelled"
    config = dict(agent.agent_config or {})
    config["awaiting_entry_fill"] = False
    agent.agent_config = config
    agent.status = AgentStatus.stopped

    log_event(db, agent.id, "entry_order_cancelled", {"order_id": str(order.id)})
    if holding:
        create_notification_event(
            db,
            holding.user_id,
            NotificationType.agent,
            f"{holding.ticker}: entry order cancelled",
            "Your limit entry order was cancelled. The agent has been stopped.",
            {"order_id": str(order.id), "ticker": holding.ticker},
        )

    db.commit()
    return {"updated": True, "order_status": order.status.value}


@router.post("/{agent_id}/pause")
def pause_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    stmt = (
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(MonitorAgent.id == UUID(agent_id), StockHolding.user_id == current_user.id)
    )
    agent = db.execute(stmt).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if agent_awaiting_entry_fill(agent):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot pause while awaiting entry fill. Cancel the entry order instead.",
        )
    agent.status = AgentStatus.paused
    db.commit()
    return {"updated": True}


@router.post("/{agent_id}/resume")
def resume_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    stmt = (
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(MonitorAgent.id == UUID(agent_id), StockHolding.user_id == current_user.id)
    )
    agent = db.execute(stmt).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if agent_awaiting_entry_fill(agent):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entry order is still open. Monitoring starts automatically after the order fills.",
        )
    if agent.status != AgentStatus.paused:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent is not paused")
    agent.status = AgentStatus.active
    if agent.next_poll_at is None:
        agent.next_poll_at = _next_poll_time(agent.polling_frequency, now=datetime.now(tz=timezone.utc))
    db.commit()
    return {"updated": True}


@router.post("/{agent_id}/square-off")
async def square_off_agent(
    agent_id: str,
    payload: SquareOffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_platform_access(db, current_user)
    stmt = (
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(MonitorAgent.id == UUID(agent_id), StockHolding.user_id == current_user.id)
    )
    agent = db.execute(stmt).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    holding = db.get(StockHolding, agent.holding_id)
    if not holding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding not found")

    positions = aggregate_exchange_positions(db, current_user.id)
    position = next((p for p in positions if p.holding_id == holding.id and p.has_exchange_position), None)
    if not position or position.net_quantity <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No exchange position to sell.")
    if payload.quantity < 1 or payload.quantity > position.net_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantity must be between 1 and {position.net_quantity}.",
        )

    decision = AgentDecision(
        agent_id=agent.id,
        decision_type=DecisionType.sell,
        reasoning=f"User-initiated square-off of {payload.quantity} shares.",
        analysis_data={"user_initiated": True, "square_off": True},
        confirmation_status=ConfirmationStatus.approved,
        confirmed_at=datetime.now(tz=timezone.utc),
    )
    db.add(decision)
    db.flush()

    order = Order(
        decision_id=decision.id,
        order_type="MARKET",
        status=OrderStatus.pending,
        price=None,
        quantity=payload.quantity,
        transaction_type="SELL",
    )
    db.add(order)
    db.flush()

    try:
        await place_and_sync_order(
            db,
            current_user,
            holding,
            order,
            order_type="MARKET",
            transaction_type="SELL",
            price=None,
        )
    except OrderPlacementError as exc:
        order.status = OrderStatus.failed
        db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    log_event(
        db,
        agent.id,
        "user_square_off",
        {"decision_id": str(decision.id), "order_id": str(order.id), "quantity": payload.quantity},
    )

    if payload.quantity >= position.net_quantity:
        agent.status = AgentStatus.paused
        log_event(db, agent.id, "agent_paused", {"reason": "full_square_off"})

    create_notification_event(
        db,
        current_user.id,
        NotificationType.agent,
        f"{holding.ticker}: square-off order placed",
        f"MARKET sell for {payload.quantity} shares sent to Upstox.",
        {"decision_id": str(decision.id), "order_id": str(order.id), "ticker": holding.ticker},
    )

    db.commit()
    return {"updated": True, "order_id": str(order.id), "order_status": order.status.value}


@router.post("/stop-all")
def stop_all_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    stmt = (
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(StockHolding.user_id == current_user.id)
    )
    agents = db.execute(stmt).scalars().all()
    for agent in agents:
        agent.status = AgentStatus.stopped
    db.commit()
    return {"updated": True, "count": len(agents)}
