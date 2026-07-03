from __future__ import annotations

import asyncio

import pytest

from backend.app.services.broker.fivepaisa import FivePaisaBroker
from backend.app.services.broker.upstox import UpstoxBroker


def test_upstox_get_available_funds(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = UpstoxBroker()

    async def fake_request(method: str, path: str, *, access_token: str | None = None, params=None, body=None):
        assert method == "GET"
        assert path == "/user/get-funds-and-margin"
        assert params == {"segment": "SEC"}
        return {"data": {"equity": {"available_margin": 45230.5, "ledger_balance": 50000.0}}}

    monkeypatch.setattr(broker, "_request", fake_request)
    monkeypatch.setattr(UpstoxBroker, "_demo_mode", property(lambda self: False))

    summary = asyncio.run(broker.get_available_funds("token-1"))
    assert summary.available_margin == 45230.5
    assert summary.ledger_balance == 50000.0


def test_fivepaisa_get_available_funds(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = FivePaisaBroker()

    async def fake_post_service(path: str, body: dict, *, access_token: str | None = None):
        assert path == "V4/Margin"
        assert body == {"ClientCode": "CLIENT01"}
        return {
            "body": {
                "EquityMargin": [{"NetAvailableMargin": 32100.25, "Ledgerbalance": 35000.0}],
            }
        }

    monkeypatch.setattr(broker.client, "post_service", fake_post_service)
    monkeypatch.setattr(FivePaisaBroker, "_demo_mode", property(lambda self: False))

    class FakeSettings:
        fivepaisa_app_key = "APPKEY"
        fivepaisa_encryption_key = "ENC"
        fivepaisa_user_id = "USER"
        fivepaisa_redirect_uri = "https://staging.daxch.app/broker/callback"
        enable_demo_mode = False
        is_production = False
        frontend_base_url = "http://localhost:3000"

    monkeypatch.setattr(broker, "settings", FakeSettings())

    summary = asyncio.run(broker.get_available_funds("token-1", client_code="CLIENT01"))
    assert summary.available_margin == 32100.25
    assert summary.ledger_balance == 35000.0
