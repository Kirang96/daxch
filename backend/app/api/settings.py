from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import User, UserSettings
from backend.app.schemas.settings import (
    AiModelOption,
    SettingsAiModelUpdateRequest,
    SettingsPreferencesUpdateRequest,
    SettingsProfileUpdateRequest,
    SettingsResponse,
)
from backend.app.services.ai.models import (
    AiModelAccessError,
    assert_model_allowed,
    can_change_model,
    list_models_for_plan,
    resolve_model,
)
from backend.app.services.plan_access import get_effective_plan_tier

router = APIRouter(prefix="/settings", tags=["settings"])


def _ensure_settings(db: Session, user: User) -> UserSettings:
    settings = db.execute(select(UserSettings).where(UserSettings.user_id == user.id)).scalar_one_or_none()
    if settings:
        return settings

    settings = UserSettings(
        user_id=user.id,
        profile_name=user.name,
        timezone="Asia/Kolkata",
        preferred_currency="INR",
        notification_preferences={
            "market_movement_alerts": True,
            "agent_conclusion_updates": True,
            "news_impact_updates": True,
            "daily_digest_email": False,
            "weekly_summary": True,
            "sms_critical_alerts": False,
        },
        security_preferences={"passwordless_login": True, "auto_logout_hours": 24},
        api_connections={
            "openai": "connected",
            "firebase_cloud_messaging": "connected",
            "aws_ses": "connected",
            "razorpay": "connected",
        },
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def _to_response(settings: UserSettings, user: User, db: Session) -> SettingsResponse:
    plan = get_effective_plan_tier(user, db)
    return SettingsResponse(
        id=settings.id,
        profile_name=settings.profile_name,
        timezone=settings.timezone,
        preferred_currency=settings.preferred_currency,
        notification_preferences=settings.notification_preferences,
        security_preferences=settings.security_preferences,
        api_connections=settings.api_connections,
        preferred_ai_model=resolve_model(plan, settings.preferred_ai_model),
        ai_model_can_change=can_change_model(plan),
        effective_plan_tier=plan,
        ai_model_options=[
            AiModelOption(
                id=model.id,
                label=model.label,
                description=model.description,
                ultra_only=model.ultra_only,
            )
            for model in list_models_for_plan(plan)
        ],
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@router.get("", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsResponse:
    settings = _ensure_settings(db, current_user)
    return _to_response(settings, current_user, db)


@router.patch("/profile", response_model=SettingsResponse)
def update_profile_settings(
    payload: SettingsProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsResponse:
    settings = _ensure_settings(db, current_user)
    if payload.profile_name is not None:
        settings.profile_name = payload.profile_name
        current_user.name = payload.profile_name
    if payload.timezone is not None:
        settings.timezone = payload.timezone
    if payload.preferred_currency is not None:
        settings.preferred_currency = payload.preferred_currency
    db.commit()
    db.refresh(settings)
    return _to_response(settings, current_user, db)


@router.patch("/preferences", response_model=SettingsResponse)
def update_preference_settings(
    payload: SettingsPreferencesUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsResponse:
    settings = _ensure_settings(db, current_user)
    if payload.notification_preferences is not None:
        settings.notification_preferences = payload.notification_preferences
    if payload.security_preferences is not None:
        settings.security_preferences = payload.security_preferences
    if payload.api_connections is not None:
        settings.api_connections = payload.api_connections
    db.commit()
    db.refresh(settings)
    return _to_response(settings, current_user, db)


@router.patch("/ai-model", response_model=SettingsResponse)
def update_ai_model_settings(
    payload: SettingsAiModelUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsResponse:
    plan = get_effective_plan_tier(current_user, db)
    try:
        assert_model_allowed(plan, payload.model)
    except AiModelAccessError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    settings = _ensure_settings(db, current_user)
    settings.preferred_ai_model = payload.model
    db.commit()
    db.refresh(settings)
    return _to_response(settings, current_user, db)
