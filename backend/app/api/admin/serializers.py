from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

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
    UserAiUsageSummary,
    UserSettings,
    WatchlistItem,
)
from backend.app.services.ai_units.service import AiUnitsService
from backend.app.services.subscription_access import get_latest_subscription


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def redact_broker(conn: BrokerConnection | None) -> dict | None:
    if not conn:
        return None
    now = datetime.now(tz=timezone.utc)
    expiry = conn.token_expiry
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    expired = bool(expiry and expiry < now)
    return {
        "id": str(conn.id),
        "broker_name": conn.broker_name,
        "connected": True,
        "expired": expired,
        "token_expires_at": _iso(expiry),
        "created_at": _iso(conn.created_at),
    }


def serialize_user_brief(user: User, db: Session) -> dict:
    sub = get_latest_subscription(db, user.id)
    broker = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == user.id)).scalar_one_or_none()
    broker_info = redact_broker(broker)
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "plan_tier": user.plan_tier.value,
        "is_active": user.is_active,
        "is_admin": user.is_admin,
        "created_at": _iso(user.created_at),
        "subscription_status": sub.status if sub else None,
        "broker_connected": bool(broker_info and broker_info.get("connected")),
        "broker_expired": bool(broker_info and broker_info.get("expired")),
    }


def serialize_user_360(db: Session, user: User) -> dict:
    sub = get_latest_subscription(db, user.id)
    sub_history = db.execute(
        select(Subscription).where(Subscription.user_id == user.id).order_by(Subscription.created_at.desc())
    ).scalars().all()
    settings = db.execute(select(UserSettings).where(UserSettings.user_id == user.id)).scalar_one_or_none()
    broker = db.execute(select(BrokerConnection).where(BrokerConnection.user_id == user.id)).scalar_one_or_none()
    holdings = db.execute(select(StockHolding).where(StockHolding.user_id == user.id)).scalars().all()
    agents = db.execute(
        select(MonitorAgent, StockHolding)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(StockHolding.user_id == user.id)
    ).all()
    agent_ids = [agent.id for agent, _ in agents]

    quota = AiUnitsService.get_quota(db, user)

    usage_events = db.execute(
        select(AiUsageEvent)
        .where(AiUsageEvent.user_id == user.id)
        .order_by(AiUsageEvent.created_at.desc())
        .limit(100)
    ).scalars().all()

    usage_summaries = db.execute(
        select(UserAiUsageSummary)
        .where(UserAiUsageSummary.user_id == user.id)
        .order_by(UserAiUsageSummary.period_start.desc())
        .limit(12)
    ).scalars().all()

    invoices = db.execute(
        select(InvoiceRecord, Subscription.plan)
        .outerjoin(Subscription, InvoiceRecord.subscription_id == Subscription.id)
        .where(InvoiceRecord.user_id == user.id)
        .order_by(InvoiceRecord.invoice_date.desc())
        .limit(50)
    ).all()

    topups = db.execute(
        select(AiUnitTopupPurchase)
        .where(AiUnitTopupPurchase.user_id == user.id)
        .order_by(AiUnitTopupPurchase.created_at.desc())
        .limit(50)
    ).scalars().all()

    notifications = db.execute(
        select(NotificationEvent)
        .where(NotificationEvent.user_id == user.id)
        .order_by(NotificationEvent.created_at.desc())
        .limit(50)
    ).scalars().all()

    watchlist = db.execute(
        select(WatchlistItem).where(WatchlistItem.user_id == user.id).order_by(WatchlistItem.created_at.desc())
    ).scalars().all()

    decisions: list[AgentDecision] = []
    orders: list[dict] = []
    if agent_ids:
        decisions = list(
            db.execute(
                select(AgentDecision)
                .where(AgentDecision.agent_id.in_(agent_ids))
                .order_by(AgentDecision.decided_at.desc())
                .limit(50)
            ).scalars().all()
        )
        order_rows = db.execute(
            select(Order, AgentDecision, MonitorAgent, StockHolding)
            .join(AgentDecision, Order.decision_id == AgentDecision.id)
            .join(MonitorAgent, AgentDecision.agent_id == MonitorAgent.id)
            .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
            .where(StockHolding.user_id == user.id)
            .order_by(Order.created_at.desc())
            .limit(50)
        ).all()
        orders = [
            {
                "id": str(order.id),
                "agent_id": str(agent.id),
                "decision_id": str(decision.id),
                "ticker": holding.ticker,
                "status": order.status.value,
                "broker_status": order.broker_status,
                "broker_order_id": order.broker_order_id,
                "order_type": order.order_type,
                "transaction_type": order.transaction_type,
                "price": order.price,
                "quantity": order.quantity,
                "filled_quantity": order.filled_quantity,
                "average_price": order.average_price,
                "created_at": _iso(order.created_at),
                "filled_at": _iso(order.filled_at),
            }
            for order, decision, agent, holding in order_rows
        ]

    audit_logs: list[AuditLog] = []
    if agent_ids:
        audit_logs = list(
            db.execute(
                select(AuditLog)
                .where(AuditLog.agent_id.in_(agent_ids))
                .order_by(AuditLog.created_at.desc())
                .limit(50)
            ).scalars().all()
        )

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "plan_tier": user.plan_tier.value,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "has_password": bool(user.password_hash),
            "created_at": _iso(user.created_at),
        },
        "subscription": {
            "plan": sub.plan.value,
            "status": sub.status,
            "razorpay_sub_id": sub.razorpay_sub_id,
            "current_period_end": _iso(sub.current_period_end) if sub else None,
            "trial_ends_at": _iso(sub.trial_ends_at) if sub else None,
        }
        if sub
        else None,
        "subscription_history": [
            {
                "id": str(s.id),
                "plan": s.plan.value,
                "status": s.status,
                "razorpay_sub_id": s.razorpay_sub_id,
                "current_period_end": _iso(s.current_period_end),
                "created_at": _iso(s.created_at),
            }
            for s in sub_history
        ],
        "ai_quota": {
            "plan_allowance": quota.plan_allowance,
            "plan_consumed": quota.plan_consumed,
            "plan_remaining": quota.plan_remaining,
            "bonus_balance": quota.bonus_balance,
            "total_remaining": quota.total_remaining,
            "total_used": quota.total_used,
            "percent_used": quota.percent_used,
            "has_active_subscription": quota.has_active_subscription,
            "period_start": _iso(quota.period_start),
            "period_end": _iso(quota.period_end),
        },
        "ai_usage_events": [
            {
                "id": str(e.id),
                "operation": e.operation_type,
                "model": e.model,
                "strategy_id": e.strategy_id,
                "ticker": e.ticker,
                "agent_id": str(e.agent_id) if e.agent_id else None,
                "prompt_tokens": e.prompt_tokens,
                "completion_tokens": e.completion_tokens,
                "units_consumed": e.units_charged,
                "created_at": _iso(e.created_at),
            }
            for e in usage_events
        ],
        "ai_usage_summaries": [
            {
                "period_start": _iso(s.period_start),
                "period_end": _iso(s.period_end),
                "units_consumed_from_plan": s.units_consumed_from_plan,
                "updated_at": _iso(s.updated_at),
            }
            for s in usage_summaries
        ],
        "payments": {
            "invoices": [
                {
                    "id": str(inv.id),
                    "invoice_id": inv.invoice_id,
                    "plan": plan.value if plan else None,
                    "amount": inv.amount,
                    "currency": inv.currency,
                    "status": inv.status,
                    "invoice_date": _iso(inv.invoice_date),
                    "period_start": _iso(inv.period_start),
                    "period_end": _iso(inv.period_end),
                    "download_url": inv.download_url,
                }
                for inv, plan in invoices
            ],
            "topups": [
                {
                    "id": str(p.id),
                    "pack_id": p.pack_id,
                    "units_granted": p.units_granted,
                    "amount": p.amount_inr,
                    "currency": "INR",
                    "status": p.status,
                    "razorpay_order_id": p.razorpay_order_id,
                    "razorpay_payment_id": p.razorpay_payment_id,
                    "created_at": _iso(p.created_at),
                    "paid_at": _iso(p.paid_at),
                }
                for p in topups
            ],
        },
        "broker": redact_broker(broker),
        "settings": {
            "profile_name": settings.profile_name if settings else None,
            "timezone": settings.timezone if settings else None,
            "preferred_currency": settings.preferred_currency if settings else None,
            "preferred_ai_model": settings.preferred_ai_model if settings else None,
            "notification_preferences": settings.notification_preferences if settings else {},
            "security_preferences": settings.security_preferences if settings else {},
        }
        if settings
        else None,
        "holdings": [
            {
                "id": str(h.id),
                "ticker": h.ticker,
                "exchange": h.exchange,
                "quantity": h.quantity,
                "entry_price": h.entry_price,
                "intention": h.intention,
                "status": h.status.value,
                "bought_at": _iso(h.bought_at),
            }
            for h in holdings
        ],
        "agents": [
            {
                "id": str(agent.id),
                "holding_id": str(holding.id),
                "ticker": holding.ticker,
                "exchange": holding.exchange,
                "status": agent.status.value,
                "polling_frequency": agent.polling_frequency,
                "next_poll_at": _iso(agent.next_poll_at),
                "awaiting_entry_fill": bool((agent.agent_config or {}).get("awaiting_entry_fill")),
                "entry_order_error": (agent.agent_config or {}).get("entry_order_error"),
                "agent_config": agent.agent_config or {},
            }
            for agent, holding in agents
        ],
        "decisions": [
            {
                "id": str(d.id),
                "agent_id": str(d.agent_id),
                "decision_type": d.decision_type.value,
                "confirmation_status": d.confirmation_status.value,
                "reasoning": d.reasoning[:500] if d.reasoning else "",
                "decided_at": _iso(d.decided_at),
                "confirmed_at": _iso(d.confirmed_at),
                "analysis_data": d.analysis_data or {},
            }
            for d in decisions
        ],
        "orders": orders,
        "notifications": [
            {
                "id": str(n.id),
                "type": n.type.value,
                "title": n.title,
                "body": n.body,
                "read_at": _iso(n.read_at),
                "created_at": _iso(n.created_at),
                "payload": n.payload or {},
            }
            for n in notifications
        ],
        "watchlist": [
            {
                "id": str(w.id),
                "ticker": w.ticker,
                "exchange": w.exchange,
                "note": w.note,
                "target_price": w.target_price,
                "created_at": _iso(w.created_at),
            }
            for w in watchlist
        ],
        "audit_logs": [
            {
                "id": str(log.id),
                "agent_id": str(log.agent_id),
                "event_type": log.event_type,
                "payload": log.payload or {},
                "created_at": _iso(log.created_at),
            }
            for log in audit_logs
        ],
    }


def serialize_agent_detail(db: Session, agent: MonitorAgent) -> dict:
    holding = db.get(StockHolding, agent.holding_id)
    user = db.get(User, holding.user_id) if holding else None

    decisions = db.execute(
        select(AgentDecision)
        .options(selectinload(AgentDecision.order))
        .where(AgentDecision.agent_id == agent.id)
        .order_by(AgentDecision.decided_at.desc())
    ).scalars().all()

    audit_logs = db.execute(
        select(AuditLog).where(AuditLog.agent_id == agent.id).order_by(AuditLog.created_at.desc()).limit(100)
    ).scalars().all()

    return {
        "agent": {
            "id": str(agent.id),
            "status": agent.status.value,
            "polling_frequency": agent.polling_frequency,
            "next_poll_at": _iso(agent.next_poll_at),
            "agent_config": agent.agent_config or {},
            "awaiting_entry_fill": bool((agent.agent_config or {}).get("awaiting_entry_fill")),
            "entry_order_error": (agent.agent_config or {}).get("entry_order_error"),
        },
        "holding": {
            "id": str(holding.id),
            "ticker": holding.ticker,
            "exchange": holding.exchange,
            "quantity": holding.quantity,
            "entry_price": holding.entry_price,
            "intention": holding.intention,
            "status": holding.status.value,
            "bought_at": _iso(holding.bought_at),
        }
        if holding
        else None,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
        }
        if user
        else None,
        "decisions": [
            {
                "id": str(d.id),
                "decision_type": d.decision_type.value,
                "confirmation_status": d.confirmation_status.value,
                "reasoning": d.reasoning,
                "analysis_data": d.analysis_data or {},
                "decided_at": _iso(d.decided_at),
                "confirmed_at": _iso(d.confirmed_at),
                "confirmation_deadline": _iso(d.confirmation_deadline),
                "order": {
                    "id": str(d.order.id),
                    "status": d.order.status.value,
                    "broker_status": d.order.broker_status,
                    "broker_order_id": d.order.broker_order_id,
                    "order_type": d.order.order_type,
                    "transaction_type": d.order.transaction_type,
                    "price": d.order.price,
                    "quantity": d.order.quantity,
                    "filled_quantity": d.order.filled_quantity,
                    "average_price": d.order.average_price,
                    "created_at": _iso(d.order.created_at),
                    "filled_at": _iso(d.order.filled_at),
                }
                if d.order
                else None,
            }
            for d in decisions
        ],
        "audit_logs": [
            {
                "id": str(log.id),
                "event_type": log.event_type,
                "payload": log.payload or {},
                "created_at": _iso(log.created_at),
            }
            for log in audit_logs
        ],
    }
