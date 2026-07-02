from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import User, UserSettings
from backend.app.services.ai.models import resolve_model


from backend.app.services.plan_access import get_effective_plan_tier


def get_resolved_ai_model(db: Session, user: User) -> str:
    settings = db.execute(select(UserSettings).where(UserSettings.user_id == user.id)).scalar_one_or_none()
    preferred = settings.preferred_ai_model if settings else None
    plan = get_effective_plan_tier(user, db)
    return resolve_model(plan, preferred)
