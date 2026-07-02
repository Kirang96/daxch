from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from backend.app.schemas.agent import OrderSnapshot


class StockCreateRequest(BaseModel):
    ticker: str = Field(min_length=1, max_length=32)
    exchange: str = "NSE"
    entry_price: float
    quantity: int
    intention: str
    request_ai_recommendation: bool = False
    ai_budget_capital: float | None = None
    enable_monitor_agent: bool = True
    polling_frequency: int = 2
    place_entry_order: bool = False
    analysis_strategy: str | None = None
    analysis_snapshot: dict | None = None
    entry_source: Literal["user", "ai"] = "user"
    force_entry: bool = False


class StockResponse(BaseModel):
    id: UUID
    ticker: str
    exchange: str
    entry_price: float
    quantity: int
    intention: str
    status: str
    sector: str | None = None
    agent_id: UUID | None = None
    agent_status: str | None = None
    awaiting_entry_fill: bool = False
    entry_order: OrderSnapshot | None = None

    model_config = {"from_attributes": True}


class StockQuoteResponse(BaseModel):
    ticker: str
    name: str | None = None
    ltp: float
    change_percent: float | None = None


class ExchangePositionResponse(BaseModel):
    holding_id: UUID
    ticker: str
    exchange: str
    net_quantity: int
    average_cost: float
    invested: float
    market_value: float | None = None
    unrealized_pnl: float | None = None
    unrealized_pnl_pct: float | None = None
    has_exchange_position: bool


class PortfolioSummaryResponse(BaseModel):
    has_exchange_positions: bool
    invested: float
    market_value: float | None = None
    unrealized_pnl: float | None = None
    unrealized_pnl_pct: float | None = None
    position_count: int


class ExchangePositionsResponse(BaseModel):
    positions: list[ExchangePositionResponse]
    summary: PortfolioSummaryResponse
