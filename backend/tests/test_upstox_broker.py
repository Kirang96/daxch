import asyncio

import httpx
import pytest

from backend.app.services.broker.upstox import BrokerConfigurationError, UpstoxBroker


def test_instrument_search_params_for_nse_equity() -> None:
    broker = UpstoxBroker()
    params = broker._instrument_search_params("reliance", "NSE")
    assert params == {"query": "RELIANCE", "records": 30, "exchanges": "NSE", "segments": "EQ"}


def test_row_matches_exchange_prefers_eq_segment() -> None:
    row = {
        "segment": "NSE_EQ",
        "exchange": "NSE",
        "trading_symbol": "RELIANCE",
        "instrument_key": "NSE_EQ|INE002A01018",
    }
    assert UpstoxBroker._row_matches_exchange(row, "NSE") is True
    assert UpstoxBroker._row_matches_exchange(row, "BSE") is False


def test_row_matches_exchange_rejects_index_for_nse_equity() -> None:
    row = {
        "segment": "NSE_INDEX",
        "exchange": "NSE",
        "trading_symbol": "NIFTY 50",
        "instrument_key": "NSE_INDEX|Nifty 50",
    }
    assert UpstoxBroker._row_matches_exchange(row, "NSE") is False
    assert UpstoxBroker._row_matches_exchange(row, "NSE_INDEX") is True


def test_resolve_instrument_key_picks_exact_nse_match(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = UpstoxBroker()

    async def fake_request(method: str, path: str, *, access_token: str | None = None, params=None, body=None):
        assert path == "/instruments/search"
        assert params["query"] == "HDFCBANK"
        return {
            "data": [
                {
                    "segment": "NSE_EQ",
                    "exchange": "NSE",
                    "trading_symbol": "HDFCBANK",
                    "instrument_key": "NSE_EQ|INE040A01034",
                },
                {
                    "segment": "BSE_EQ",
                    "exchange": "BSE",
                    "trading_symbol": "HDFCBANK",
                    "instrument_key": "BSE_EQ|INE040A01034",
                },
            ]
        }

    monkeypatch.setattr(broker, "_request", fake_request)
    monkeypatch.setattr(UpstoxBroker, "_demo_mode", property(lambda self: False))

    resolved = asyncio.run(broker._resolve_instrument_key("HDFCBANK", "NSE", "token"))
    assert resolved == "NSE_EQ|INE040A01034"


def test_request_maps_upstox_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    broker = UpstoxBroker()

    async def fake_client_request(*args, **kwargs):
        request = httpx.Request("GET", "https://api.upstox.com/v2/instruments/search")
        response = httpx.Response(401, request=request)
        response._content = b'{"message":"Invalid token"}'
        raise httpx.HTTPStatusError("Unauthorized", request=request, response=response)

    monkeypatch.setattr("httpx.AsyncClient.request", fake_client_request)

    with pytest.raises(BrokerConfigurationError, match="Reconnect your broker account"):
        asyncio.run(broker._request("GET", "/instruments/search", access_token="bad-token"))
