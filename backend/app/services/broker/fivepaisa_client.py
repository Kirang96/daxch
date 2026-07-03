from __future__ import annotations

from typing import Any

import httpx

from backend.app.core.config import get_settings
from backend.app.services.broker.base import BrokerConfigurationError


class FivePaisaClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def app_key(self) -> str:
        return self.settings.fivepaisa_app_key

    def _service_url(self, path: str) -> str:
        base = self.settings.fivepaisa_api_url.rstrip("/")
        return f"{base}/{path.lstrip('/')}"

    async def post_service(
        self,
        path: str,
        body: dict[str, Any],
        *,
        access_token: str | None = None,
    ) -> dict[str, Any]:
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        payload = {"head": {"Key": self.app_key}, "body": body}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(self._service_url(path), json=payload, headers=headers)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            raise BrokerConfigurationError(f"Unable to reach 5paisa: {exc}") from exc

        head = data.get("head") or {}
        if str(head.get("status")) not in {"0", "0.0", ""}:
            desc = head.get("statusDescription") or head.get("StatusDescription") or "Request failed"
            raise BrokerConfigurationError(f"5paisa error: {desc}")
        return data

    async def get_market(
        self,
        path: str,
        *,
        access_token: str,
        params: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
        base = self.settings.fivepaisa_market_url.rstrip("/")
        url = f"{base}/{path.lstrip('/')}"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(url, headers=headers, params=params or {})
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as exc:
            raise BrokerConfigurationError(f"Unable to reach 5paisa market API: {exc}") from exc
