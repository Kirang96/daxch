from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from zoneinfo import ZoneInfo

from backend.app.core.config import get_settings
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
from backend.app.services.broker.fivepaisa_client import FivePaisaClient
from backend.app.services.broker.scrip_master import resolve_scrip
from backend.app.services.market_hours import should_use_amo

IST = ZoneInfo("Asia/Kolkata")


def fivepaisa_end_of_day_expiry() -> datetime:
    now = datetime.now(IST)
    expiry = now.replace(hour=23, minute=59, second=0, microsecond=0)
    if now >= expiry:
        expiry += timedelta(days=1)
    return expiry.astimezone(timezone.utc)


def _map_order_status(status: str) -> str:
    normalized = (status or "").strip().lower()
    if normalized == "fully executed":
        return "complete"
    if normalized in {"pending", "modified", "xmitted"}:
        return "pending"
    if normalized == "cancelled":
        return "cancelled"
    if normalized in {"rejected by 5p", "rejected by exch"}:
        return "rejected"
    return normalized or "unknown"


class FivePaisaBroker(BaseBroker):
    name = "5paisa"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.client = FivePaisaClient()

    def _validate_configuration(self) -> None:
        if (
            self.settings.fivepaisa_app_key
            and self.settings.fivepaisa_encryption_key
            and self.settings.fivepaisa_user_id
            and self.settings.fivepaisa_redirect_uri
        ):
            return
        if not self.settings.enable_demo_mode:
            raise BrokerConfigurationError("5paisa credentials are required when demo mode is disabled.")
        if self.settings.is_production:
            raise BrokerConfigurationError("5paisa credentials are not configured for production.")

    @property
    def _demo_mode(self) -> bool:
        return (
            self.settings.enable_demo_mode
            and not self.settings.is_production
            and not self.settings.fivepaisa_app_key
        )

    def get_auth_url(self, state: str) -> str:
        self._validate_configuration()
        if self._demo_mode:
            return f"{self.settings.frontend_base_url.rstrip('/')}/broker/callback?broker=5paisa&RequestToken=demo&state={state}"
        login_url = self.settings.fivepaisa_login_url.rstrip("/")
        redirect = self.settings.fivepaisa_redirect_uri
        vendor_key = self.settings.fivepaisa_app_key
        query = urlencode({"VendorKey": vendor_key, "ResponseURL": redirect, "State": state})
        return f"{login_url}?{query}"

    async def authenticate(self, auth_code: str) -> TokenPair:
        self._validate_configuration()
        if self._demo_mode or auth_code == "demo":
            return TokenPair(
                access_token="demo-5paisa-access-token",
                refresh_token="demo-5paisa-refresh-token",
                expires_at=fivepaisa_end_of_day_expiry(),
                metadata={"client_code": "DEMOCLIENT", "client_name": "Demo User"},
            )

        data = await self.client.post_service(
            "GetAccessToken",
            {
                "RequestToken": auth_code,
                "EncryKey": self.settings.fivepaisa_encryption_key,
                "UserId": self.settings.fivepaisa_user_id,
            },
        )
        body = data.get("body") or {}
        if int(body.get("Status", -1)) != 0:
            message = body.get("Message") or "Access token request failed"
            raise BrokerConfigurationError(f"5paisa login failed: {message}")

        access_token = body.get("AccessToken") or ""
        if not access_token:
            raise BrokerConfigurationError("5paisa login failed: missing access token.")

        return TokenPair(
            access_token=access_token,
            refresh_token=body.get("RefreshToken") or "",
            expires_at=fivepaisa_end_of_day_expiry(),
            metadata={
                "client_code": body.get("ClientCode") or "",
                "client_name": body.get("ClientName") or "",
            },
        )

    async def refresh_token(self, refresh_token: str) -> TokenPair:
        self._validate_configuration()
        if self._demo_mode:
            return TokenPair(
                access_token="demo-5paisa-access-token",
                refresh_token=refresh_token or "demo-5paisa-refresh-token",
                expires_at=fivepaisa_end_of_day_expiry(),
                metadata={"client_code": "DEMOCLIENT"},
            )
        raise BrokerConfigurationError(
            "Your 5paisa session expires daily. Please reconnect your broker account."
        )

    def _require_token(self, access_token: str | None) -> str:
        if access_token:
            return access_token
        raise BrokerConfigurationError("Missing broker access token. Connect your broker and try again.")

    async def get_quote(
        self,
        ticker: str,
        exchange: str = "NSE",
        access_token: str | None = None,
    ) -> StockQuote:
        self._validate_configuration()
        if self._demo_mode:
            return StockQuote(ticker=ticker.upper(), ltp=150.0, change_percent=0.5)

        token = self._require_token(access_token)
        scrip = await resolve_scrip(ticker, exchange, demo=False)
        data = await self.client.post_service(
            "V1/MarketFeed",
            {
                "MarketFeedData": [
                    {
                        "Exch": scrip.exch,
                        "ExchType": scrip.exch_type,
                        "ScripCode": str(scrip.scrip_code) if scrip.scrip_code else "",
                        "ScripData": scrip.scrip_data if not scrip.scrip_code else "",
                    }
                ],
                "LastRequestTime": "/Date(0)/",
                "RefreshRate": "H",
            },
            access_token=token,
        )
        body = data.get("body") or {}
        rows = body.get("Data") or []
        if not rows:
            raise BrokerConfigurationError(f"No quote data returned for {ticker}.")
        row = rows[0]
        ltp = row.get("LastRate")
        if ltp is None:
            raise BrokerConfigurationError(f"Quote response missing price for {ticker}.")
        return StockQuote(
            ticker=ticker.upper(),
            ltp=float(ltp),
            change_percent=float(row.get("ChgPcnt")) if row.get("ChgPcnt") is not None else None,
        )

    async def place_order(self, access_token: str, order: OrderRequest) -> OrderResponse:
        self._validate_configuration()
        if self._demo_mode:
            return OrderResponse(order_id="SIMULATED-5P-001", status="placed", exchange_order_id="DEMO-EX-5P")

        token = self._require_token(access_token)
        scrip = await resolve_scrip(order.ticker, order.exchange, demo=False)
        remote_order_id = order.remote_order_id or ""
        if not remote_order_id:
            raise BrokerConfigurationError("Internal error: remote order id is required for 5paisa orders.")

        order_type = "Buy" if order.transaction_type.upper() == "BUY" else "Sell"
        price = 0 if order.order_type.upper() == "MARKET" else float(order.price or 0)

        data = await self.client.post_service(
            "V1/PlaceOrderRequest",
            {
                "Exchange": scrip.exch,
                "ExchangeType": scrip.exch_type,
                "ScripCode": str(scrip.scrip_code),
                "Price": str(price),
                "StopLossPrice": "0",
                "OrderType": order_type,
                "Qty": int(order.quantity),
                "DisQty": "0",
                "IsIntraday": False,
                "iOrderValidity": "0",
                "AHPlaced": "Y" if should_use_amo() else "N",
                "RemoteOrderID": remote_order_id,
                "AlgoID": self.settings.fivepaisa_algo_id or 0,
            },
            access_token=token,
        )
        body = data.get("body") or {}
        if int(body.get("Status", -1)) != 0:
            message = body.get("Message") or "Order placement failed"
            raise BrokerConfigurationError(f"5paisa order failed: {message}")

        broker_order_id = body.get("BrokerOrderID")
        if not broker_order_id:
            raise BrokerConfigurationError("5paisa order placed but no BrokerOrderID was returned.")

        exch_order_id = body.get("ExchOrderID")
        return OrderResponse(
            order_id=str(broker_order_id),
            status="placed",
            exchange_order_id=str(exch_order_id) if exch_order_id not in (None, "", "0", 0) else None,
            metadata={"remote_order_id": remote_order_id},
        )

    async def get_order_status(self, access_token: str, query: OrderStatusQuery) -> OrderStatusResponse:
        self._validate_configuration()
        if self._demo_mode:
            return OrderStatusResponse(
                broker_order_id=query.broker_order_id,
                status="complete",
                filled_quantity=1,
                pending_quantity=0,
                average_price=100.0,
                exchange_order_id="DEMO-EX-5P",
                transaction_type="BUY",
                ticker="DEMO",
                message=None,
            )

        token = self._require_token(access_token)
        remote_order_id = query.remote_order_id or query.broker_order_id
        if not query.client_code:
            raise BrokerConfigurationError("Missing 5paisa client code for order status.")
        if not remote_order_id:
            raise BrokerConfigurationError("Missing remote order id for 5paisa order status.")

        exch = "N"
        if query.exchange and query.exchange.upper() == "BSE":
            exch = "B"

        data = await self.client.post_service(
            "V2/OrderStatus",
            {
                "ClientCode": query.client_code,
                "OrdStatusReqList": [{"Exch": exch, "RemoteOrderID": remote_order_id}],
            },
            access_token=token,
        )
        body = data.get("body") or {}
        rows = body.get("OrdStatusResLst") or []
        if not rows:
            raise BrokerConfigurationError(f"No order status found for {remote_order_id}.")

        row = rows[0]
        broker_status = str(row.get("Status") or row.get("OrderStatus") or "unknown")
        mapped = _map_order_status(broker_status)
        traded_qty = int(row.get("TradedQty") or 0)
        pending_qty = int(row.get("PendingQty") or 0)
        avg_price = row.get("AveragePrice")
        return OrderStatusResponse(
            broker_order_id=query.broker_order_id,
            status=mapped,
            filled_quantity=traded_qty,
            pending_quantity=pending_qty,
            average_price=float(avg_price) if avg_price not in (None, "", 0) else None,
            exchange_order_id=str(row.get("ExchOrderID")) if row.get("ExchOrderID") else None,
            transaction_type=None,
            ticker=row.get("Symbol"),
            message=broker_status,
        )

    async def cancel_order(self, access_token: str, exchange_order_id: str) -> None:
        self._validate_configuration()
        if self._demo_mode:
            return
        token = self._require_token(access_token)
        data = await self.client.post_service(
            "V1/CancelOrderRequest",
            {"ExchOrderID": exchange_order_id},
            access_token=token,
        )
        body = data.get("body") or {}
        if int(body.get("Status", -1)) != 0:
            message = body.get("Message") or "Cancel failed"
            raise BrokerConfigurationError(f"5paisa cancel failed: {message}")

    def _interval_path(self, interval: str) -> str:
        mapping = {
            "day": "1d",
            "1d": "1d",
            "1m": "1m",
            "5m": "5m",
            "15m": "15m",
            "30m": "30m",
            "60m": "60m",
        }
        return mapping.get(interval.lower(), "1d")

    async def get_ohlcv_candles(
        self,
        ticker: str,
        exchange: str,
        interval: str,
        access_token: str,
    ) -> list[CandleBar]:
        self._validate_configuration()
        if self._demo_mode:
            quote = await self.get_quote(ticker=ticker, exchange=exchange)
            base = quote.ltp
            bars: list[CandleBar] = []
            start = datetime.now(IST).date() - timedelta(days=249)
            price = base
            for i in range(250):
                close = round(price * (1 + ((i % 5) - 2) * 0.002), 2)
                bars.append(
                    CandleBar(
                        timestamp=(start + timedelta(days=i)).isoformat(),
                        open=price,
                        high=max(price, close) * 1.005,
                        low=min(price, close) * 0.995,
                        close=close,
                        volume=100000.0,
                    )
                )
                price = close
            return bars

        token = self._require_token(access_token)
        scrip = await resolve_scrip(ticker, exchange, demo=False)
        if scrip.scrip_code <= 0:
            raise BrokerConfigurationError(f"Unknown scrip for {ticker} on {exchange}.")

        end = datetime.now(IST).date()
        start = end - timedelta(days=365)
        interval_code = self._interval_path(interval)
        path = f"historical/{scrip.exch}/{scrip.exch_type}/{scrip.scrip_code}/{interval_code}"
        data = await self.client.get_market(
            path,
            access_token=token,
            params={"from": start.isoformat(), "end": end.isoformat()},
        )
        candles = (data.get("data") or {}).get("candles") or []
        bars = [
            CandleBar(
                timestamp=str(row[0]),
                open=float(row[1]),
                high=float(row[2]),
                low=float(row[3]),
                close=float(row[4]),
                volume=float(row[5]) if len(row) > 5 else 0.0,
            )
            for row in candles
        ]
        return bars[-250:]

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
            return BrokerFundsSummary(available_margin=98_500.75, ledger_balance=100_000.0)

        token = self._require_token(access_token)
        if not client_code:
            raise BrokerConfigurationError("Missing 5paisa client code for funds lookup.")

        data = await self.client.post_service(
            "V4/Margin",
            {"ClientCode": client_code},
            access_token=token,
        )
        body = data.get("body") or {}
        rows = body.get("EquityMargin") or []
        row = rows[0] if rows else {}
        ledger = row.get("Ledgerbalance")
        return BrokerFundsSummary(
            available_margin=float(row.get("NetAvailableMargin") or 0),
            ledger_balance=float(ledger) if ledger is not None else None,
        )
