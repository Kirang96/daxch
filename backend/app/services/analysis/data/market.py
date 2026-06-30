from typing import Any

from backend.app.services.broker.base import BaseBroker, CandleBar, StockQuote


class MarketDataFetcher:
    async def fetch(
        self,
        broker: BaseBroker,
        *,
        ticker: str,
        exchange: str,
        access_token: str,
        interval: str = "day",
    ) -> dict[str, Any]:
        quote: StockQuote | None = None
        candles: list[CandleBar] = []
        errors: list[str] = []

        try:
            quote = await broker.get_quote(
                ticker=ticker.upper(),
                exchange=exchange,
                access_token=access_token,
            )
        except Exception as exc:
            errors.append(f"quote: {exc}")

        try:
            candles = await broker.get_ohlcv_candles(
                ticker=ticker.upper(),
                exchange=exchange,
                interval=interval,
                access_token=access_token,
            )
        except Exception as exc:
            errors.append(f"candles: {exc}")

        return {
            "quote": quote,
            "candles": candles,
            "errors": errors,
        }
