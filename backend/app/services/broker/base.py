from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


class BrokerConfigurationError(RuntimeError):
    pass


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str
    expires_at: datetime
    metadata: dict = field(default_factory=dict)


@dataclass
class StockQuote:
    ticker: str
    ltp: float
    change_percent: float | None = None


@dataclass
class CandleBar:
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float


@dataclass
class OrderRequest:
    ticker: str
    exchange: str
    transaction_type: str
    quantity: int
    order_type: str = "MARKET"
    price: float | None = None
    remote_order_id: str | None = None


@dataclass
class OrderResponse:
    order_id: str
    status: str
    exchange_order_id: str | None = None
    metadata: dict = field(default_factory=dict)


@dataclass
class OrderStatusResponse:
    broker_order_id: str
    status: str
    filled_quantity: int
    pending_quantity: int
    average_price: float | None
    exchange_order_id: str | None
    transaction_type: str | None
    ticker: str | None
    message: str | None = None


@dataclass
class OrderStatusQuery:
    broker_order_id: str
    remote_order_id: str | None = None
    exchange: str | None = None
    client_code: str | None = None


@dataclass
class BrokerMeta:
    id: str
    name: str
    description: str
    available: bool


class BaseBroker(ABC):
    name: str = "base"

    @abstractmethod
    def get_auth_url(self, state: str) -> str: ...

    @abstractmethod
    async def authenticate(self, auth_code: str) -> TokenPair: ...

    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> TokenPair: ...

    @abstractmethod
    async def get_quote(
        self,
        ticker: str,
        exchange: str = "NSE",
        access_token: str | None = None,
    ) -> StockQuote: ...

    @abstractmethod
    async def place_order(self, access_token: str, order: OrderRequest) -> OrderResponse: ...

    @abstractmethod
    async def get_order_status(
        self,
        access_token: str,
        query: OrderStatusQuery,
    ) -> OrderStatusResponse: ...

    @abstractmethod
    async def cancel_order(self, access_token: str, exchange_order_id: str) -> None: ...

    @abstractmethod
    async def get_candles(
        self,
        ticker: str,
        exchange: str,
        interval: str,
        access_token: str,
    ) -> list[float]: ...

    @abstractmethod
    async def get_ohlcv_candles(
        self,
        ticker: str,
        exchange: str,
        interval: str,
        access_token: str,
    ) -> list[CandleBar]: ...
