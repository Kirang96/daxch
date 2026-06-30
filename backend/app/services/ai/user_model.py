from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import User, UserSettings
from backend.app.services.ai.models import resolve_model


def get_resolved_ai_model(db: Session, user: User) -> str:
    settings = db.execute(select(UserSettings).where(UserSettings.user_id == user.id)).scalar_one_or_none()
    preferred = settings.preferred_ai_model if settings else None
    return resolve_model(user.plan_tier.value, preferred)
