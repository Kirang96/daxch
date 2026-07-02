from sqlalchemy.orm import Session

from backend.app.models.entities import PlanTier, User
from backend.app.services.subscription_access import get_latest_subscription, is_paid_active


def get_effective_plan_tier(user: User, db: Session, *, sync: bool = True) -> str:
    """Resolve plan tier from active subscription when it differs from user.plan_tier."""
    sub = get_latest_subscription(db, user.id)
    if sub and is_paid_active(sub):
        effective = sub.plan.value
    else:
        effective = user.plan_tier.value

    if sync and user.plan_tier.value != effective:
        user.plan_tier = PlanTier(effective)
        db.commit()
        db.refresh(user)

    return effective
