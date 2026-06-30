from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import PlanTier, Subscription, User


def get_latest_subscription(db: Session, user_id) -> Subscription | None:
    stmt = select(Subscription).where(Subscription.user_id == user_id).order_by(Subscription.created_at.desc())
    return db.execute(stmt).scalars().first()


def is_paid_active(sub: Subscription, now: datetime | None = None) -> bool:
    now = now or datetime.now(tz=timezone.utc)
    if sub.status in {"active", "authenticated"}:
        if sub.current_period_end and sub.current_period_end < now:
            return False
        return True
    return False


def has_platform_access(sub: Subscription | None, now: datetime | None = None) -> bool:
    if not sub:
        return False
    return is_paid_active(sub, now)


def require_platform_access(db: Session, user: User) -> Subscription:
    sub = get_latest_subscription(db, user.id)
    if sub and has_platform_access(sub):
        return sub
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail="An active subscription is required. Choose a plan on the Subscription page.",
    )
