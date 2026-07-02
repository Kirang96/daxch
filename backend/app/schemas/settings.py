from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AiModelOption(BaseModel):
    id: str
    label: str
    description: str
    ultra_only: bool = False


class SettingsResponse(BaseModel):
    id: UUID
    profile_name: str | None
    timezone: str | None
    preferred_currency: str | None
    notification_preferences: dict
    security_preferences: dict
    api_connections: dict
    preferred_ai_model: str
    ai_model_can_change: bool
    effective_plan_tier: str
    ai_model_options: list[AiModelOption]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SettingsAiModelUpdateRequest(BaseModel):
    model: str = Field(min_length=1, max_length=64)


class SettingsProfileUpdateRequest(BaseModel):
    profile_name: str | None = None
    timezone: str | None = None
    preferred_currency: str | None = None


class SettingsPreferencesUpdateRequest(BaseModel):
    notification_preferences: dict | None = None
    security_preferences: dict | None = None
    api_connections: dict | None = None

