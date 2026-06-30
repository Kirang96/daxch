from typing import Any

import httpx

from backend.app.core.config import get_settings
from backend.app.services.analysis.data.company_names import resolve_company_name


class TavilySearchFetcher:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def fetch(self, ticker: str, exchange: str = "NSE") -> dict[str, Any]:
        if not self.settings.tavily_api_key:
            return {"results": [], "errors": ["tavily_api_key_missing"]}

        company = resolve_company_name(ticker.upper())
        queries = [
            f"{company} {exchange} India stock news latest",
            f"{ticker.upper()} NSE earnings results filing announcement",
            f"{company} India share price analyst rating",
        ]

        results: list[dict[str, Any]] = []
        errors: list[str] = []
        seen_urls: set[str] = set()
        tavily_credits = 0

        async with httpx.AsyncClient(timeout=25) as client:
            for query in queries:
                if len(results) >= 8:
                    break
                batch, batch_errors, credits_used = await self._search(client, query)
                errors.extend(batch_errors)
                tavily_credits += credits_used
                for item in batch:
                    url = item.get("url", "")
                    if url and url in seen_urls:
                        continue
                    if url:
                        seen_urls.add(url)
                    results.append(item)

        if not results:
            errors.append("no_web_search_results")

        return {"results": results[:8], "errors": errors, "tavily_credits": tavily_credits}

    async def _search(self, client: httpx.AsyncClient, query: str) -> tuple[list[dict[str, Any]], list[str], int]:
        try:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": self.settings.tavily_api_key,
                    "query": query,
                    "search_depth": "basic",
                    "max_results": 5,
                    "include_answer": False,
                },
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            return [], [f"tavily_fetch_failed: {exc}"], 0

        results = [
            {
                "title": item.get("title", ""),
                "snippet": item.get("content", "") or item.get("snippet", "") or "",
                "url": item.get("url", ""),
                "source": item.get("source", ""),
            }
            for item in (data.get("results") or [])
            if item.get("title") or item.get("content")
        ]
        return results, [], 1
