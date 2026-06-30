from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WatchlistCreateRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=32)
    exchange: str = "NSE"
    note: str | None = None
    target_price: float | None = None


class WatchlistUpdateRequest(BaseModel):
    note: str | None = None
    target_price: float | None = None


class WatchlistResponse(BaseModel):
    id: UUID
    ticker: str
    exchange: str
    note: str | None
    target_price: float | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

