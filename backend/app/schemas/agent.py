from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AgentCreateRequest(BaseModel):
    holding_id: UUID
    polling_frequency: int = 2
    auto_execute_on_timeout: bool = False
    confirmation_timeout_minutes: int = 5


class AgentResponse(BaseModel):
    id: UUID
    holding_id: UUID
    polling_frequency: int
    status: str
    next_poll_at: datetime | None

    model_config = {"from_attributes": True}


class OrderSnapshot(BaseModel):
    """Lightweight order info embedded in each DecisionResponse."""
    id: UUID
    broker_order_id: str | None
    order_type: str
    status: str
    price: float
    quantity: int
    filled_quantity: int = 0
    average_price: float | None = None
    transaction_type: str | None = None
    broker_status: str | None = None
    filled_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DecisionResponse(BaseModel):
    id: UUID
    agent_id: UUID
    decision_type: str
    reasoning: str
    analysis_data: dict
    confirmation_status: str
    decided_at: datetime
    confirmed_at: datetime | None = None
    order: OrderSnapshot | None = None

    model_config = {"from_attributes": True}


class AgentHoldingSnapshot(BaseModel):
    id: UUID
    ticker: str
    exchange: str
    entry_price: float
    quantity: int
    intention: str
    status: str

    model_config = {"from_attributes": True}


class AgentDetailResponse(BaseModel):
    agent: AgentResponse
    holding: AgentHoldingSnapshot
    decisions: list[DecisionResponse]
    recent_audit: list[dict]


class BrokerOrderStatus(BaseModel):
    """Live order status fetched from the broker."""
    order_id: UUID
    broker_order_id: str
    internal_status: str          # DB status (placed, filled, failed, cancelled)
    broker_status: str            # Raw Upstox status string
    filled_quantity: int
    pending_quantity: int
    average_price: float | None
    exchange_order_id: str | None
    transaction_type: str | None
    ticker: str | None
    message: str | None

