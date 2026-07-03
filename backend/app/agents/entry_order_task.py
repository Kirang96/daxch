import asyncio

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from backend.app.agents.celery_app import celery_app
from backend.app.db.session import SessionLocal
from backend.app.models.entities import (
    AgentDecision,
    AgentStatus,
    DecisionType,
    MonitorAgent,
    Order,
    OrderStatus,
    StockHolding,
)
from backend.app.services.broker.factory import get_broker
from backend.app.services.broker.session import get_valid_broker_token_for_user
from backend.app.services.entry_fill import activate_agent_after_entry_fill, agent_awaiting_entry_fill
from backend.app.services.entry_order_state import apply_entry_order_broker_status
from backend.app.services.positions.order_sync import is_order_fully_filled, is_order_terminal


def _get_entry_order_for_agent(db: Session, agent: MonitorAgent) -> tuple[AgentDecision, Order, StockHolding] | None:
    config = agent.agent_config or {}
    decision_id = config.get("entry_decision_id")
    if decision_id:
        decision = db.get(AgentDecision, decision_id)
        if decision:
            db.refresh(decision, ["order"])
    else:
        stmt = (
            select(AgentDecision)
            .options(selectinload(AgentDecision.order))
            .where(
                AgentDecision.agent_id == agent.id,
                AgentDecision.decision_type == DecisionType.initial_entry,
            )
            .order_by(AgentDecision.decided_at.desc())
            .limit(1)
        )
        decision = db.execute(stmt).scalar_one_or_none()

    if not decision or not decision.order:
        return None

    holding = db.get(StockHolding, agent.holding_id)
    if not holding:
        return None

    return decision, decision.order, holding


async def _poll_pending_entry_orders() -> int:
    processed = 0
    with SessionLocal() as db:
        stmt = select(MonitorAgent).where(MonitorAgent.status == AgentStatus.paused)
        agents = db.execute(stmt).scalars().all()

        for agent in agents:
            if not agent_awaiting_entry_fill(agent):
                continue

            entry = _get_entry_order_for_agent(db, agent)
            if not entry:
                continue

            _decision, order, holding = entry
            if not order.broker_order_id:
                continue

            if is_order_fully_filled(order):
                activate_agent_after_entry_fill(db, agent, holding, order)
                processed += 1
                continue

            if is_order_terminal(order):
                if order.status == OrderStatus.cancelled:
                    config = dict(agent.agent_config or {})
                    config["awaiting_entry_fill"] = False
                    agent.agent_config = config
                    agent.status = AgentStatus.stopped
                processed += 1
                continue

            broker = get_broker("upstox")
            try:
                _, token = await get_valid_broker_token_for_user(
                    db=db, user_id=holding.user_id, broker=broker
                )
                live = await broker.get_order_status(order.broker_order_id, token)
            except Exception:
                continue

            apply_entry_order_broker_status(
                db,
                agent=agent,
                holding=holding,
                order=order,
                live=live,
            )

            processed += 1

        db.commit()

    return processed


@celery_app.task(name="backend.app.agents.entry_order_task.poll_pending_entry_orders")
def poll_pending_entry_orders() -> int:
    return asyncio.run(_poll_pending_entry_orders())
