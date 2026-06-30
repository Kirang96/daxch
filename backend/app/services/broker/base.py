from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime


@dataclass
class TokenPair:
    access_token: str
    refresh_token: str
    expires_at: datetime


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


@dataclass
class OrderResponse:
    order_id: str
    status: str


@dataclass
class OrderStatusResponse:
    broker_order_id: str
    status: str                      # complete | open | rejected | cancelled | pending | modified
    filled_quantity: int
    pending_quantity: int
    average_price: float | None
    exchange_order_id: str | None
    transaction_type: str | None     # BUY | SELL
    ticker: str | None
    message: str | None = None       # rejection reason, etc.


class BaseBroker(ABC):
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
    async def get_order_status(self, broker_order_id: str, access_token: str) -> OrderStatusResponse: ...

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


