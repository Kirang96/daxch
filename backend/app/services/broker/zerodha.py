from backend.app.services.broker.base import (
    BaseBroker,
    BrokerConfigurationError,
    CandleBar,
    OrderRequest,
    OrderResponse,
    OrderStatusQuery,
    OrderStatusResponse,
    StockQuote,
    TokenPair,
)


class ZerodhaBroker(BaseBroker):
    async def get_auth_url(self, state: str) -> str:  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def authenticate(self, auth_code: str) -> TokenPair:  # pragma: no cover - future integration
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def refresh_token(self, refresh_token: str) -> TokenPair:  # pragma: no cover - future integration
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def get_quote(
        self,
        ticker: str,
        exchange: str = "NSE",
        access_token: str | None = None,
    ) -> StockQuote:  # pragma: no cover - future integration
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def place_order(self, access_token: str, order: OrderRequest) -> OrderResponse:  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def get_order_status(
        self, access_token: str, query: OrderStatusQuery
    ) -> OrderStatusResponse:  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def cancel_order(self, access_token: str, exchange_order_id: str) -> None:  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def get_candles(
        self, ticker: str, exchange: str, interval: str, access_token: str
    ) -> list[float]:  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def get_ohlcv_candles(
        self, ticker: str, exchange: str, interval: str, access_token: str
    ) -> list[CandleBar]:  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

