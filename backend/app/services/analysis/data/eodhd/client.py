from __future__ import annotations

from typing import Any

import httpx

from backend.app.core.config import get_settings

EODHD_BASE_URL = "https://eodhd.com/api"


class EodhdFetchError(RuntimeError):
    pass


class EodhdClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def api_token(self) -> str:
        return self.settings.eodhd_api_key.strip()

    async def get(self, path: str, *, params: dict[str, Any] | None = None) -> Any:
        if not self.api_token:
            raise EodhdFetchError("eodhd_api_key_missing")

        query = dict(params or {})
        query["api_token"] = self.api_token
        query.setdefault("fmt", "json")
        url = f"{EODHD_BASE_URL}/{path.lstrip('/')}"
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(url, params=query)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:200] if exc.response.text else exc.response.reason_phrase
            raise EodhdFetchError(f"EODHD HTTP {exc.response.status_code}: {detail}") from exc
        except httpx.HTTPError as exc:
            raise EodhdFetchError(f"EODHD request failed: {exc}") from exc
