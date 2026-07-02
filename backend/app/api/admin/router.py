from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.middleware.auth import get_admin_user
from backend.app.models.entities import (
    AgentDecision,
    AiUsageEvent,
    AuditLog,
    BrokerConnection,
    InvoiceRecord,
    MonitorAgent,
    NotificationEvent,
    Order,
    StockHolding,
    Subscription,
    User,
    UserSettings,
    WebhookEvent,
)
from backend.app.services.subscription_access import get_latest_subscription

router = APIRouter(prefix="/admin", tags=["admin"])


def _redact_broker(conn: BrokerConnection | None) -> dict | None:
    if not conn:
        return None
    return {
        "id": str(conn.id),
        "broker_name": conn.broker_name,
        "is_connected": bool(conn.access_token),
        "token_expires_at": conn.token_expiry.isoformat() if conn.token_expiry else None,
        "created_at": conn.created_at.isoformat() if conn.created_at else None,
    }


@router.get("/overview")
def admin_overview(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    now = datetime.now(tz=timezone.utc)
    day_ago = now - timedelta(hours=24)
    users = db.execute(select(func.count()).select_from(User)).scalar_one()
    agents = db.execute(select(func.count()).select_from(MonitorAgent)).scalar_one()
    active_agents = db.execute(
        select(func.count()).select_from(MonitorAgent).where(MonitorAgent.status == "active")
    ).scalar_one()
    failed_orders = db.execute(
        select(func.count()).select_from(Order).where(
            Order.status.in_(["failed"]),
            Order.created_at >= day_ago,
        )
    ).scalar_one()
    webhooks = db.execute(select(func.count()).select_from(WebhookEvent)).scalar_one()
    ai_units_today = db.execute(
        select(func.coalesce(func.sum(AiUsageEvent.units_charged), 0)).where(AiUsageEvent.created_at >= day_ago)
    ).scalar_one()
    return {
        "users": users,
        "agents": agents,
        "active_agents": active_agents,
        "failed_orders_24h": failed_orders,
        "webhook_events": webhooks,
        "ai_units_consumed_24h": int(ai_units_today or 0),
    }


@router.get("/users")
def admin_list_users(
    search: str = "",
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    stmt = select(User).order_by(User.created_at.desc())
    if search.strip():
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(User.email.ilike(pattern))
    total = len(db.execute(stmt).scalars().all())
    users = db.execute(stmt.offset(offset).limit(limit)).scalars().all()
    return {
        "total": total,
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "name": u.name,
                "plan_tier": u.plan_tier.value,
                "is_active": u.is_active,
                "is_admin": u.is_admin,
                "created_at": u.created_at.isoformat(),
            }
            for u in users
        ],
    }


@router.get("/users/{user_id}")
def admin_user_detail(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    user = db.get(User, user_id)
    if not user:
        return {"error": "not_found"}
    sub = get_latest_subscription(db, user.id)
    settings = db.execute(select(UserSettings).where(UserSettings.user_id == user.id)).scalar_one_or_none()
    broker = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == user.id)).scalar_one_or_none()
    holdings = db.execute(select(StockHolding).where(StockHolding.user_id == user.id)).scalars().all()
    agents = db.execute(
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(StockHolding.user_id == user.id)
    ).scalars().all()
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "plan_tier": user.plan_tier.value,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "created_at": user.created_at.isoformat(),
        },
        "subscription": {
            "plan": sub.plan.value,
            "status": sub.status,
            "current_period_end": sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
        }
        if sub
        else None,
        "settings": {
            "preferred_ai_model": settings.preferred_ai_model if settings else None,
            "timezone": settings.timezone if settings else None,
        },
        "broker": _redact_broker(broker),
        "holdings_count": len(holdings),
        "agents_count": len(agents),
        "holdings": [
            {"id": str(h.id), "ticker": h.ticker, "exchange": h.exchange, "quantity": h.quantity, "entry_price": h.entry_price}
            for h in holdings
        ],
        "agents": [
            {
                "id": str(a.id),
                "status": a.status.value,
                "polling_frequency": a.polling_frequency,
                "awaiting_entry_fill": bool((a.agent_config or {}).get("awaiting_entry_fill")),
                "entry_order_error": (a.agent_config or {}).get("entry_order_error"),
            }
            for a in agents
        ],
    }


@router.get("/agents")
def admin_list_agents(
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    stmt = (
        select(MonitorAgent, StockHolding)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .order_by(MonitorAgent.id.desc())
    )
    rows = db.execute(stmt.offset(offset).limit(limit)).all()
    return {
        "items": [
            {
                "id": str(agent.id),
                "status": agent.status.value,
                "polling_frequency": agent.polling_frequency,
                "next_poll_at": agent.next_poll_at.isoformat() if agent.next_poll_at else None,
                "ticker": holding.ticker,
                "user_id": str(holding.user_id),
                "awaiting_entry_fill": bool((agent.agent_config or {}).get("awaiting_entry_fill")),
                "entry_order_error": (agent.agent_config or {}).get("entry_order_error"),
            }
            for agent, holding in rows
        ]
    }


@router.get("/orders")
def admin_list_orders(
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    stmt = (
        select(Order, AgentDecision, MonitorAgent, StockHolding)
        .join(AgentDecision, Order.decision_id == AgentDecision.id)
        .join(MonitorAgent, AgentDecision.agent_id == MonitorAgent.id)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return {
        "items": [
            {
                "id": str(order.id),
                "status": order.status.value,
                "broker_status": order.broker_status,
                "order_type": order.order_type,
                "transaction_type": order.transaction_type,
                "price": order.price,
                "quantity": order.quantity,
                "ticker": holding.ticker,
                "user_id": str(holding.user_id),
                "agent_id": str(agent.id),
                "created_at": order.created_at.isoformat(),
            }
            for order, _decision, agent, holding in rows
        ]
    }


@router.get("/subscriptions")
def admin_list_subscriptions(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    subs = db.execute(select(Subscription).order_by(Subscription.created_at.desc()).limit(200)).scalars().all()
    return {
        "items": [
            {
                "id": str(s.id),
                "user_id": str(s.user_id),
                "plan": s.plan.value,
                "status": s.status,
                "razorpay_sub_id": s.razorpay_sub_id,
                "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
                "created_at": s.created_at.isoformat(),
            }
            for s in subs
        ]
    }


@router.get("/webhooks")
def admin_list_webhooks(
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    events = db.execute(select(WebhookEvent).order_by(WebhookEvent.created_at.desc()).limit(limit)).scalars().all()
    return {
        "items": [
            {
                "id": str(e.id),
                "source": e.source,
                "event_hash": e.event_hash,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ]
    }


@router.get("/ai-usage")
def admin_ai_usage(
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    events = db.execute(select(AiUsageEvent).order_by(AiUsageEvent.created_at.desc()).limit(limit)).scalars().all()
    return {
        "items": [
            {
                "id": str(e.id),
                "user_id": str(e.user_id),
                "operation": e.operation_type,
                "model": e.model,
                "units_consumed": e.units_charged,
                "created_at": e.created_at.isoformat(),
            }
            for e in events
        ]
    }


@router.get("/audit")
def admin_audit(
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    logs = db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).scalars().all()
    return {
        "items": [
            {
                "id": str(log.id),
                "agent_id": str(log.agent_id),
                "event_type": log.event_type,
                "payload": log.payload,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ]
    }


@router.get("/notifications")
def admin_notifications(
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    events = db.execute(select(NotificationEvent).order_by(NotificationEvent.created_at.desc()).limit(limit)).scalars().all()
    return {
        "items": [
            {
                "id": str(e.id),
                "user_id": str(e.user_id),
                "type": e.type.value,
                "title": e.title,
                "body": e.body,
                "created_at": e.created_at.isoformat(),
                "payload": e.payload,
            }
            for e in events
        ]
    }
