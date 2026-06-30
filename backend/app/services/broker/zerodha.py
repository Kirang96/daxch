from backend.app.services.broker.base import BaseBroker, CandleBar, OrderRequest, OrderResponse, StockQuote, TokenPair


class ZerodhaBroker(BaseBroker):
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

    async def place_order(self, access_token: str, order: OrderRequest) -> OrderResponse:  # pragma: no cover - future integration
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def get_order_status(self, broker_order_id: str, access_token: str):  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def get_candles(
        self, ticker: str, exchange: str, interval: str, access_token: str
    ) -> list[float]:  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

    async def get_ohlcv_candles(
        self, ticker: str, exchange: str, interval: str, access_token: str
    ) -> list[CandleBar]:  # pragma: no cover
        raise NotImplementedError("Zerodha integration is planned for a future release.")

