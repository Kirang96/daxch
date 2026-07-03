"""Unit tests for FivePaisaBroker (mocked HTTP).

Staging manual checklist (sandbox only — no production E2E):
1. Register Xstream keys; set staging secrets + FIVEPAISA_REDIRECT_URI
2. Connect 5paisa → connection-status shows broker=5paisa, client_code in metadata
3. Callback handles RequestToken query param
4. Research quote returns LTP via MarketFeed for NSE equity
5. Historical candles load on agent/research charts
6. LIMIT entry → RemoteOrderID = order UUID → Celery poll sees status transition
7. Approve sell → MARKET order (Price=0) places successfully
8. Switch Upstox ↔ 5paisa overwrites connection
9. Upstox regression on staging unchanged
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse

import pytest

from backend.app.services.broker.base import BrokerConfigurationError, OrderRequest, OrderStatusQuery
from backend.app.services.broker.fivepaisa import FivePaisaBroker, _map_order_status
from backend.app.services.broker.scrip_master import ScripInfo


def test_map_order_status_fully_executed() -> None:
    assert _map_order_status("Fully Executed") == "complete"
    assert _map_order_status("Rejected By 5P") == "rejected"
    assert _map_order_status("Xmitted") == "pending"


def test_get_auth_url_includes_vendor_key(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = FivePaisaBroker()

    class FakeSettings:
        fivepaisa_app_key = "APPKEY"
        fivepaisa_encryption_key = "ENC"
        fivepaisa_user_id = "USER"
        fivepaisa_redirect_uri = "https://staging.daxch.app/broker/callback"
        fivepaisa_login_url = "https://dev-openapi.5paisa.com/WebVendorLogin/VLogin/Index"
        enable_demo_mode = False
        is_production = False
        frontend_base_url = "http://localhost:3000"

    monkeypatch.setattr(broker, "settings", FakeSettings())
    url = broker.get_auth_url("5paisa:onboarding")
    parsed = parse_qs(urlparse(url).query)
    assert parsed["VendorKey"] == ["APPKEY"]
    assert parsed["ResponseURL"] == ["https://staging.daxch.app/broker/callback"]
    assert parsed["State"] == ["5paisa:onboarding"]


def test_authenticate_get_access_token(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = FivePaisaBroker()

    class FakeSettings:
        fivepaisa_app_key = "APPKEY"
        fivepaisa_encryption_key = "ENC"
        fivepaisa_user_id = "USER"
        fivepaisa_redirect_uri = "https://staging.daxch.app/broker/callback"
        enable_demo_mode = False
        is_production = False
        frontend_base_url = "http://localhost:3000"

    async def fake_post_service(path: str, body: dict, *, access_token: str | None = None):
        assert path == "GetAccessToken"
        assert body["RequestToken"] == "req-token-1"
        assert body["EncryKey"] == "ENC"
        assert body["UserId"] == "USER"
        return {
            "body": {
                "Status": 0,
                "AccessToken": "jwt-access",
                "RefreshToken": "refresh",
                "ClientCode": "CLIENT01",
                "ClientName": "Test User",
            }
        }

    monkeypatch.setattr(broker, "settings", FakeSettings())
    monkeypatch.setattr(broker.client, "post_service", fake_post_service)
    monkeypatch.setattr(FivePaisaBroker, "_demo_mode", property(lambda self: False))

    token = asyncio.run(broker.authenticate("req-token-1"))
    assert token.access_token == "jwt-access"
    assert token.metadata["client_code"] == "CLIENT01"
    assert token.expires_at > datetime.now(tz=timezone.utc)


def test_authenticate_invalid_session(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = FivePaisaBroker()

    class FakeSettings:
        fivepaisa_app_key = "APPKEY"
        fivepaisa_encryption_key = "ENC"
        fivepaisa_user_id = "USER"
        fivepaisa_redirect_uri = "https://staging.daxch.app/broker/callback"
        enable_demo_mode = False
        is_production = False
        frontend_base_url = "http://localhost:3000"

    async def fake_post_service(path: str, body: dict, *, access_token: str | None = None):
        return {"body": {"Status": 9, "Message": "Invalid Session"}}

    monkeypatch.setattr(broker, "settings", FakeSettings())
    monkeypatch.setattr(broker.client, "post_service", fake_post_service)
    monkeypatch.setattr(FivePaisaBroker, "_demo_mode", property(lambda self: False))

    with pytest.raises(BrokerConfigurationError, match="Invalid Session"):
        asyncio.run(broker.authenticate("bad-token"))


def test_place_order_sets_remote_order_id(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = FivePaisaBroker()
    captured: dict = {}

    class FakeSettings:
        fivepaisa_app_key = "APPKEY"
        fivepaisa_encryption_key = "ENC"
        fivepaisa_user_id = "USER"
        fivepaisa_redirect_uri = "https://staging.daxch.app/broker/callback"
        fivepaisa_algo_id = "0"
        enable_demo_mode = False
        is_production = False
        frontend_base_url = "http://localhost:3000"

    async def fake_resolve(ticker: str, exchange: str, *, demo: bool = False):
        return ScripInfo(
            ticker="RELIANCE",
            exchange="NSE",
            exch="N",
            exch_type="C",
            scrip_code=2885,
            scrip_data="RELIANCE_EQ",
        )

    async def fake_post_service(path: str, body: dict, *, access_token: str | None = None):
        captured["path"] = path
        captured["body"] = body
        return {
            "body": {
                "Status": 0,
                "BrokerOrderID": "BO123",
                "ExchOrderID": "EX456",
                "RemoteOrderID": body["RemoteOrderID"],
            }
        }

    monkeypatch.setattr(broker, "settings", FakeSettings())
    monkeypatch.setattr("backend.app.services.broker.fivepaisa.resolve_scrip", fake_resolve)
    monkeypatch.setattr(broker.client, "post_service", fake_post_service)
    monkeypatch.setattr(FivePaisaBroker, "_demo_mode", property(lambda self: False))

    result = asyncio.run(
        broker.place_order(
            "token",
            OrderRequest(
                ticker="RELIANCE",
                exchange="NSE",
                transaction_type="BUY",
                quantity=10,
                order_type="LIMIT",
                price=2450.5,
                remote_order_id="order-uuid-1",
            ),
        )
    )

    assert result.order_id == "BO123"
    assert result.exchange_order_id == "EX456"
    assert captured["path"] == "V1/PlaceOrderRequest"
    assert captured["body"]["RemoteOrderID"] == "order-uuid-1"
    assert captured["body"]["OrderType"] == "Buy"
    assert captured["body"]["Price"] == "2450.5"


def test_get_order_status_by_remote_order_id(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = FivePaisaBroker()

    class FakeSettings:
        fivepaisa_app_key = "APPKEY"
        fivepaisa_encryption_key = "ENC"
        fivepaisa_user_id = "USER"
        fivepaisa_redirect_uri = "https://staging.daxch.app/broker/callback"
        enable_demo_mode = False
        is_production = False
        frontend_base_url = "http://localhost:3000"

    async def fake_post_service(path: str, body: dict, *, access_token: str | None = None):
        assert path == "V2/OrderStatus"
        assert body["ClientCode"] == "CLIENT01"
        assert body["OrdStatusReqList"][0]["RemoteOrderID"] == "order-uuid-1"
        return {
            "body": {
                "OrdStatusResLst": [
                    {
                        "Status": "Fully Executed",
                        "TradedQty": 10,
                        "PendingQty": 0,
                        "AveragePrice": 2450.0,
                        "ExchOrderID": "EX456",
                        "Symbol": "RELIANCE",
                    }
                ]
            }
        }

    monkeypatch.setattr(broker, "settings", FakeSettings())
    monkeypatch.setattr(broker.client, "post_service", fake_post_service)
    monkeypatch.setattr(FivePaisaBroker, "_demo_mode", property(lambda self: False))

    live = asyncio.run(
        broker.get_order_status(
            "token",
            OrderStatusQuery(
                broker_order_id="BO123",
                remote_order_id="order-uuid-1",
                exchange="NSE",
                client_code="CLIENT01",
            ),
        )
    )

    assert live.status == "complete"
    assert live.filled_quantity == 10
    assert live.exchange_order_id == "EX456"


def test_resolve_scrip_demo_lookup() -> None:
    from backend.app.services.broker.scrip_master import resolve_scrip

    scrip = asyncio.run(resolve_scrip("RELIANCE", "NSE", demo=True))
    assert scrip.scrip_code == 2885
    assert scrip.scrip_data == "RELIANCE_EQ"
