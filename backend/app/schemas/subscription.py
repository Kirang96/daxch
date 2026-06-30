from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SubscriptionCreateRequest(BaseModel):
    plan: str


class SubscriptionResponse(BaseModel):
    id: UUID
    plan: str
    status: str
    current_period_end: datetime | None
    trial_ends_at: datetime | None = None
    days_left: int | None = None
    is_trial: bool = False
    checkout_url: str | None = None
    provider_subscription_id: str | None = None

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    id: UUID
    invoice_id: str
    amount: float
    currency: str
    status: str
    invoice_date: datetime
    period_start: datetime | None
    period_end: datetime | None
    download_url: str | None

    model_config = {"from_attributes": True}

