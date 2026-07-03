from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from backend.app.services.broker.fivepaisa_client import FivePaisaClient


def test_post_service_uses_capital_key_in_head(monkeypatch) -> None:
    client = FivePaisaClient()
    client.settings = SimpleNamespace(
        fivepaisa_app_key="APPKEY",
        fivepaisa_api_url="https://Openapi.5paisa.com/VendorsAPI/Service1.svc",
    )

    captured: dict = {}

    async def fake_post(url, *, json=None, headers=None):
        captured["json"] = json
        response = AsyncMock()
        response.raise_for_status = lambda: None
        response.json = lambda: {"head": {"status": "0"}, "body": {}}
        return response

    async def run() -> None:
        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client_cls.return_value.__aenter__.return_value = mock_client
            mock_client.post = fake_post
            await client.post_service("GetAccessToken", {"RequestToken": "tok"})

    asyncio.run(run())
    assert captured["json"]["head"] == {"Key": "APPKEY"}
