from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.middleware.auth import get_admin_user
from backend.app.models.entities import (
    AgentDecision,
    AiUnitTopupPurchase,
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
from backend.app.services.ai_units.service import AiUnitsService
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
    stmt = (
        select(AiUsageEvent, User.email)
        .join(User, AiUsageEvent.user_id == User.id)
        .order_by(AiUsageEvent.created_at.desc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    return {
        "items": [
            {
                "id": str(e.id),
                "user_id": str(e.user_id),
                "email": email,
                "operation": e.operation_type,
                "model": e.model,
                "ticker": e.ticker,
                "units_consumed": e.units_charged,
                "created_at": e.created_at.isoformat(),
            }
            for e, email in rows
        ]
    }


@router.get("/ai-usage/by-user")
def admin_ai_usage_by_user(
    search: str = "",
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    stmt = select(User).order_by(User.created_at.desc())
    if search.strip():
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(User.email.ilike(pattern))
    count_stmt = select(func.count()).select_from(User)
    if search.strip():
        count_stmt = count_stmt.where(User.email.ilike(pattern))
    total = db.execute(count_stmt).scalar_one()
    users = db.execute(stmt.offset(offset).limit(limit)).scalars().all()

    items = []
    for user in users:
        quota = AiUnitsService.get_quota(db, user)
        sub = get_latest_subscription(db, user.id)
        events_in_period = db.execute(
            select(func.count())
            .select_from(AiUsageEvent)
            .where(
                AiUsageEvent.user_id == user.id,
                AiUsageEvent.period_start == quota.period_start,
            )
        ).scalar_one()
        items.append(
            {
                "user_id": str(user.id),
                "email": user.email,
                "name": user.name,
                "plan_tier": user.plan_tier.value,
                "subscription_status": sub.status if sub else None,
                "plan_allowance": quota.plan_allowance,
                "plan_consumed": quota.plan_consumed,
                "bonus_balance": quota.bonus_balance,
                "total_remaining": quota.total_remaining,
                "percent_used": quota.percent_used,
                "period_start": quota.period_start.isoformat(),
                "period_end": quota.period_end.isoformat(),
                "events_in_period": int(events_in_period or 0),
            }
        )

    return {"total": int(total or 0), "items": items}


@router.get("/payments")
def admin_payments(
    limit: int = Query(default=200, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> dict:
    invoice_rows = db.execute(
        select(InvoiceRecord, User.email, Subscription.plan)
        .join(User, InvoiceRecord.user_id == User.id)
        .outerjoin(Subscription, InvoiceRecord.subscription_id == Subscription.id)
        .order_by(InvoiceRecord.invoice_date.desc())
        .limit(limit)
    ).all()
    topup_rows = db.execute(
        select(AiUnitTopupPurchase, User.email)
        .join(User, AiUnitTopupPurchase.user_id == User.id)
        .order_by(AiUnitTopupPurchase.created_at.desc())
        .limit(limit)
    ).all()

    return {
        "invoices": [
            {
                "id": str(inv.id),
                "user_id": str(inv.user_id),
                "email": email,
                "type": "subscription",
                "invoice_id": inv.invoice_id,
                "plan": plan.value if plan else None,
                "amount": inv.amount,
                "currency": inv.currency,
                "status": inv.status,
                "invoice_date": inv.invoice_date.isoformat(),
                "period_start": inv.period_start.isoformat() if inv.period_start else None,
                "period_end": inv.period_end.isoformat() if inv.period_end else None,
                "download_url": inv.download_url,
            }
            for inv, email, plan in invoice_rows
        ],
        "topups": [
            {
                "id": str(p.id),
                "user_id": str(p.user_id),
                "email": email,
                "type": "ai_topup",
                "pack_id": p.pack_id,
                "units_granted": p.units_granted,
                "amount": p.amount_inr,
                "currency": "INR",
                "status": p.status,
                "razorpay_order_id": p.razorpay_order_id,
                "razorpay_payment_id": p.razorpay_payment_id,
                "created_at": p.created_at.isoformat(),
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            }
            for p, email in topup_rows
        ],
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
