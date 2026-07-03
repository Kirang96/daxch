import uuid
from datetime import datetime, timedelta, timezone

import httpx

from backend.app.core.config import get_settings
from backend.app.services.market_hours import should_use_amo
from backend.app.services.broker.base import (
    BaseBroker,
    BrokerConfigurationError,
    BrokerFundsSummary,
    CandleBar,
    OrderRequest,
    OrderResponse,
    OrderStatusQuery,
    OrderStatusResponse,
    StockQuote,
    TokenPair,
)


class UpstoxBroker(BaseBroker):
    name = "upstox"
    def __init__(self) -> None:
        self.settings = get_settings()
        self.token_url = "https://api.upstox.com/v2/login/authorization/token"

    def _validate_configuration(self) -> None:
        if self.settings.upstox_client_id and self.settings.upstox_client_secret and self.settings.upstox_redirect_uri:
            return
        if not self.settings.enable_demo_mode:
            raise BrokerConfigurationError("Upstox credentials are required when demo mode is disabled.")
        if self.settings.is_production:
            raise BrokerConfigurationError("Upstox credentials are not configured for production.")

    @property
    def _demo_mode(self) -> bool:
        return (
            self.settings.enable_demo_mode
            and not self.settings.is_production
            and not self.settings.upstox_client_id
            and not self.settings.upstox_client_secret
        )

    async def _token_request(self, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(self.token_url, data=payload)
            response.raise_for_status()
            return response.json()

    async def _request(
        self,
        method: str,
        path: str,
        *,
        access_token: str | None = None,
        params: dict | None = None,
        body: dict | None = None,
    ) -> dict:
        headers = {"Accept": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                response = await client.request(
                    method,
                    f"{self.settings.upstox_base_url.rstrip('/')}/{path.lstrip('/')}",
                    headers=headers,
                    params=params,
                    json=body,
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            detail = self._extract_error_detail(exc.response)
            if status_code in (401, 403):
                raise BrokerConfigurationError(
                    "Your Upstox session expired or lacks market data access. Reconnect your broker account."
                ) from exc
            if status_code == 404:
                raise BrokerConfigurationError("Upstox resource not found for this request.") from exc
            raise BrokerConfigurationError(f"Upstox request failed ({status_code}): {detail}") from exc
        except httpx.HTTPError as exc:
            raise BrokerConfigurationError(f"Unable to reach Upstox: {exc}") from exc

    @staticmethod
    def _extract_error_detail(response: httpx.Response) -> str:
        try:
            payload = response.json()
        except ValueError:
            text = response.text.strip()
            return text[:240] if text else response.reason_phrase
        if isinstance(payload, dict):
            for key in ("message", "error", "detail"):
                value = payload.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
            errors = payload.get("errors")
            if isinstance(errors, list) and errors:
                first = errors[0]
                if isinstance(first, dict):
                    return str(first.get("message") or first.get("error") or first)
                return str(first)
        return response.reason_phrase

    def _instrument_search_params(self, ticker: str, exchange: str) -> dict[str, str | int]:
        exchange_upper = exchange.upper()
        params: dict[str, str | int] = {"query": ticker.upper(), "records": 30}
        if exchange_upper in {"NSE", "BSE", "MCX"}:
            params["exchanges"] = exchange_upper
            params["segments"] = "EQ"
        elif exchange_upper.endswith("_INDEX"):
            params["exchanges"] = exchange_upper.replace("_INDEX", "")
            params["segments"] = "INDEX"
        else:
            params["exchanges"] = exchange_upper
        return params

    @staticmethod
    def _row_matches_exchange(row: dict, exchange: str) -> bool:
        exchange_upper = exchange.upper()
        segment = str(row.get("segment") or "").upper()
        row_exchange = str(row.get("exchange") or "").upper()
        if exchange_upper in {"NSE", "BSE", "MCX"}:
            return segment == f"{exchange_upper}_EQ" or (
                row_exchange == exchange_upper and segment.endswith("_EQ")
            )
        if exchange_upper.endswith("_INDEX"):
            return segment.endswith("_INDEX") and (
                segment == exchange_upper or row_exchange == exchange_upper.replace("_INDEX", "")
            )
        return row_exchange == exchange_upper or segment.startswith(f"{exchange_upper}_")

    def _require_access_token(self, access_token: str | None) -> str:
        if access_token:
            return access_token
        raise BrokerConfigurationError("Missing broker access token. Connect Upstox and refresh your session.")

    async def _resolve_instrument_key(self, ticker: str, exchange: str, access_token: str | None) -> str:
        if "|" in ticker:
            return ticker
        if self._demo_mode:
            return f"{exchange.upper()}_EQ|{ticker.upper()}"

        token = self._require_access_token(access_token)
        search = await self._request(
            "GET",
            "/instruments/search",
            access_token=token,
            params=self._instrument_search_params(ticker, exchange),
        )
        rows = search.get("data", []) or []
        if not rows:
            raise BrokerConfigurationError(f"Unable to find instrument key for {ticker} on {exchange}.")

        ticker_upper = ticker.upper()
        exact_match = None
        exchange_match = None
        for row in rows:
            if not isinstance(row, dict):
                continue
            symbol = str(row.get("trading_symbol") or row.get("tradingsymbol") or row.get("symbol") or "").upper()
            instrument_key = row.get("instrument_key") or row.get("instrument_token")
            if not instrument_key:
                continue
            if self._row_matches_exchange(row, exchange):
                exchange_match = instrument_key
            if symbol == ticker_upper and self._row_matches_exchange(row, exchange):
                exact_match = instrument_key
                break

        resolved = exact_match or exchange_match
        if not resolved:
            raise BrokerConfigurationError(f"No supported instrument mapping found for {ticker} on {exchange}.")
        return str(resolved)

    def get_auth_url(self, state: str) -> str:
        self._validate_configuration()
        if not self.settings.upstox_client_id or not self.settings.upstox_redirect_uri:
            raise BrokerConfigurationError("Upstox OAuth is not configured.")
        return (
            "https://api.upstox.com/v2/login/authorization/dialog"
            f"?response_type=code&client_id={self.settings.upstox_client_id}"
            f"&redirect_uri={self.settings.upstox_redirect_uri}&state={state}"
        )

    async def authenticate(self, auth_code: str) -> TokenPair:
        self._validate_configuration()
        if self._demo_mode:
            return TokenPair(
                access_token="demo-access-token",
                refresh_token="demo-refresh-token",
                expires_at=datetime.now(tz=timezone.utc) + timedelta(hours=1),
            )

        payload = {
            "code": auth_code,
            "client_id": self.settings.upstox_client_id,
            "client_secret": self.settings.upstox_client_secret,
            "redirect_uri": self.settings.upstox_redirect_uri,
            "grant_type": "authorization_code",
        }
        data = await self._token_request(payload)

        expires_in = data.get("expires_in")
        # Default to 24 hours if expires_in is not provided
        seconds_to_expire = int(expires_in) if expires_in is not None else 86400
        expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=seconds_to_expire)
        return TokenPair(
            access_token=data["access_token"],
            refresh_token=data.get("refresh_token", ""),
            expires_at=expires_at,
        )

    async def refresh_token(self, refresh_token: str) -> TokenPair:
        self._validate_configuration()
        if self._demo_mode:
            return TokenPair(
                access_token="demo-access-token",
                refresh_token="demo-refresh-token",
                expires_at=datetime.now(tz=timezone.utc) + timedelta(hours=1),
            )

        raise BrokerConfigurationError("Your Upstox broker session has expired. Please reconnect your broker account.")

    async def get_quote(
        self,
        ticker: str,
        exchange: str = "NSE",
        access_token: str | None = None,
    ) -> StockQuote:
        self._validate_configuration()
        if self._demo_mode:
            if ticker.upper() in ("NIFTY 50", "NSE_INDEX|NIFTY 50"):
                return StockQuote(ticker=ticker, ltp=24812.30, change_percent=0.42)
            elif ticker.upper() in ("SENSEX", "BSE_INDEX|SENSEX"):
                return StockQuote(ticker=ticker, ltp=81210.84, change_percent=0.36)
            elif ticker.upper() in ("NIFTY BANK", "NSE_INDEX|NIFTY BANK", "NIFTY_BANK"):
                return StockQuote(ticker=ticker, ltp=52140.50, change_percent=-0.18)
            return StockQuote(ticker=ticker, ltp=150.0, change_percent=0.5)


        token = self._require_access_token(access_token)
        instrument_key = await self._resolve_instrument_key(ticker=ticker, exchange=exchange, access_token=token)
        data = await self._request(
            "GET",
            "/market-quote/ltp",
            access_token=token,
            params={"instrument_key": instrument_key},
        )

        quote_map = data.get("data", {}) or {}
        quote = quote_map.get(instrument_key) if isinstance(quote_map, dict) else None
        if not quote and isinstance(quote_map, dict):
            # Fallback for providers that may key by alt id.
            quote = next(iter(quote_map.values()), {})
        if not quote:
            raise BrokerConfigurationError(f"No quote data returned for {ticker} ({instrument_key}).")

        ltp = quote.get("last_price", quote.get("ltp"))
        if ltp is None:
            raise BrokerConfigurationError(f"Quote response missing price for {ticker} ({instrument_key}).")
        return StockQuote(
            ticker=ticker.upper(),
            ltp=float(ltp),
            change_percent=quote.get("change_percent"),
        )

    async def place_order(self, access_token: str, order: OrderRequest) -> OrderResponse:
        self._validate_configuration()
        if self._demo_mode:
            return OrderResponse(order_id="SIMULATED-ORDER-001", status="placed")

        token = self._require_access_token(access_token)
        instrument_key = await self._resolve_instrument_key(
            ticker=order.ticker,
            exchange=order.exchange,
            access_token=token,
        )
        payload = {
            "quantity": order.quantity,
            "product": "D",
            "validity": "DAY",
            "price": order.price or 0,
            "tag": f"daxch-{uuid.uuid4().hex[:18]}",
            "instrument_token": instrument_key,
            "order_type": order.order_type,
            "transaction_type": order.transaction_type.upper(),
            "disclosed_quantity": 0,
            "trigger_price": 0,
            "is_amo": should_use_amo(),
        }
        data = await self._request("POST", "/order/place", access_token=token, body=payload)
        order_id = data.get("data", {}).get("order_id") or data.get("data", {}).get("id")
        if not order_id:
            raise BrokerConfigurationError("Order placed but no order_id was returned by broker.")
        return OrderResponse(order_id=str(order_id), status="placed")

    async def cancel_order(self, access_token: str, exchange_order_id: str) -> None:
        self._validate_configuration()
        if self._demo_mode:
            return

        token = self._require_access_token(access_token)
        await self._request(
            "DELETE",
            "/order/cancel",
            access_token=token,
            params={"order_id": exchange_order_id},
        )

    async def get_order_status(self, access_token: str, query: OrderStatusQuery) -> OrderStatusResponse:
        self._validate_configuration()
        broker_order_id = query.broker_order_id
        if self._demo_mode:
            return OrderStatusResponse(
                broker_order_id=broker_order_id,
                status="complete",
                filled_quantity=1,
                pending_quantity=0,
                average_price=100.0,
                exchange_order_id="DEMO-EX-001",
                transaction_type="BUY",
                ticker="DEMO",
                message=None,
            )

        token = self._require_access_token(access_token)
        try:
            data = await self._request(
                "GET",
                "/order/details",
                access_token=token,
                params={"order_id": broker_order_id},
            )
        except Exception as exc:
            raise BrokerConfigurationError(
                f"Unable to fetch order status for {broker_order_id}: {exc}"
            ) from exc

        order_data = data.get("data") or {}
        if isinstance(order_data, list):
            # Some Upstox endpoints return a list; take the most recent entry
            order_data = order_data[-1] if order_data else {}

        return OrderStatusResponse(
            broker_order_id=broker_order_id,
            status=str(order_data.get("status", "unknown")).lower(),
            filled_quantity=int(order_data.get("filled_quantity", 0)),
            pending_quantity=int(order_data.get("pending_quantity", 0)),
            average_price=float(order_data["average_price"]) if order_data.get("average_price") else None,
            exchange_order_id=order_data.get("exchange_order_id"),
            transaction_type=order_data.get("transaction_type"),
            ticker=order_data.get("trading_symbol"),
            message=order_data.get("status_message") or order_data.get("rejection_reason"),
        )

    def _demo_ohlcv_bars(self, ticker: str, base_price: float) -> list[CandleBar]:
        import random
        from datetime import date, timedelta

        random.seed(hash(ticker))
        bars: list[CandleBar] = []
        price = base_price
        start = date.today() - timedelta(days=249)
        for i in range(250):
            change = random.uniform(-0.015, 0.015)
            open_p = price
            close_p = round(price * (1 + change), 2)
            high_p = round(max(open_p, close_p) * (1 + random.uniform(0, 0.008)), 2)
            low_p = round(min(open_p, close_p) * (1 - random.uniform(0, 0.008)), 2)
            vol = random.randint(100_000, 5_000_000)
            bars.append(
                CandleBar(
                    timestamp=(start + timedelta(days=i)).isoformat(),
                    open=open_p,
                    high=high_p,
                    low=low_p,
                    close=close_p,
                    volume=float(vol),
                )
            )
            price = close_p
        return bars

    def _parse_ohlcv_response(self, candles_list: list, ticker: str) -> list[CandleBar]:
        if not candles_list:
            return self._demo_ohlcv_bars(ticker, 100.0)
        bars = [
            CandleBar(
                timestamp=str(candle[0]),
                open=float(candle[1]),
                high=float(candle[2]),
                low=float(candle[3]),
                close=float(candle[4]),
                volume=float(candle[5]) if len(candle) > 5 else 0.0,
            )
            for candle in candles_list
        ]
        bars.reverse()
        return bars[-250:]

    async def _fetch_historical_candles(
        self,
        ticker: str,
        exchange: str,
        interval: str,
        access_token: str,
    ) -> list:
        token = self._require_access_token(access_token)
        instrument_key = await self._resolve_instrument_key(
            ticker=ticker,
            exchange=exchange,
            access_token=token,
        )

        from datetime import date, timedelta

        to_dt = date.today()
        from_dt = to_dt - timedelta(days=365)
        to_str = to_dt.strftime("%Y-%m-%d")
        from_str = from_dt.strftime("%Y-%m-%d")

        data = await self._request(
            "GET",
            f"/historical-candle/{instrument_key}/{interval}/{to_str}/{from_str}",
            access_token=token,
        )
        return data.get("data", {}).get("candles", [])

    async def get_ohlcv_candles(
        self,
        ticker: str,
        exchange: str,
        interval: str,
        access_token: str,
    ) -> list[CandleBar]:
        self._validate_configuration()
        if self._demo_mode:
            try:
                quote = await self.get_quote(ticker=ticker, exchange=exchange)
                base_price = quote.ltp
            except Exception:
                base_price = 150.0
            return self._demo_ohlcv_bars(ticker, base_price)

        try:
            candles_list = await self._fetch_historical_candles(
                ticker, exchange, interval, access_token
            )
        except Exception as exc:
            raise BrokerConfigurationError(
                f"Unable to fetch historical candles for {ticker}: {exc}"
            ) from exc

        return self._parse_ohlcv_response(candles_list, ticker)

    async def get_candles(
        self,
        ticker: str,
        exchange: str,
        interval: str,
        access_token: str,
    ) -> list[float]:
        bars = await self.get_ohlcv_candles(ticker, exchange, interval, access_token)
        return [bar.close for bar in bars]

    async def get_available_funds(
        self,
        access_token: str,
        *,
        client_code: str | None = None,
    ) -> BrokerFundsSummary:
        self._validate_configuration()
        if self._demo_mode:
            return BrokerFundsSummary(available_margin=125_000.50, ledger_balance=130_000.0)

        data = await self._request(
            "GET",
            "/user/get-funds-and-margin",
            access_token=access_token,
            params={"segment": "SEC"},
        )
        equity = (data.get("data") or {}).get("equity") or {}
        ledger = equity.get("ledger_balance")
        return BrokerFundsSummary(
            available_margin=float(equity.get("available_margin") or 0),
            ledger_balance=float(ledger) if ledger is not None else None,
        )


