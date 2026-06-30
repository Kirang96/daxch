from datetime import datetime

from pydantic import BaseModel


class AiUnitsQuotaResponse(BaseModel):
    plan_allowance: int
    plan_remaining: int
    plan_consumed: int
    bonus_balance: int
    total_remaining: int
    total_used: int
    total_limit: int
    percent_used: float
    period_start: datetime
    period_end: datetime
    has_active_subscription: bool


class AiUnitsEstimateResponse(BaseModel):
    estimated_monthly_units: int
    total_daily_polls: int | None = None
    model: str


class TopupPackResponse(BaseModel):
    id: str
    units: int
    price_inr: int
    label: str


class TopupOrderResponse(BaseModel):
    order_id: str
    amount: int
    currency: str
    key_id: str
    purchase_id: str
    pack_id: str
    units: int


class TopupConfirmRequest(BaseModel):
    order_id: str
    payment_id: str
    signature: str


class TopupPurchaseResponse(BaseModel):
    id: str
    pack_id: str
    units_granted: int
    amount_inr: int
    status: str
    created_at: datetime
    paid_at: datetime | None
