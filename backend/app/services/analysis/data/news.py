import re
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from backend.app.core.config import get_settings
from backend.app.services.analysis.data.company_names import build_news_queries, resolve_company_name


def _normalize_title(title: str) -> str:
    return re.sub(r"\s+", " ", title.lower().strip())


def _dedupe_articles(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for article in articles:
        key = _normalize_title(article.get("title", ""))
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(article)
    return unique


def _parse_newsapi_payload(data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    if data.get("status") != "ok":
        code = data.get("code", "unknown")
        message = data.get("message", "NewsAPI returned an error")
        return [], [f"news_api_error:{code}:{message}"]

    raw = data.get("articles", []) or []
    articles = [
        {
            "title": item.get("title", ""),
            "source": (item.get("source") or {}).get("name", ""),
            "published_at": item.get("publishedAt", ""),
            "summary": item.get("description", "") or item.get("content", "") or "",
            "url": item.get("url", ""),
            "origin": "newsapi",
        }
        for item in raw
        if item.get("title")
    ]
    return articles, []


class NewsDataFetcher:
    def __init__(self) -> None:
        self.settings = get_settings()

    async def fetch(self, ticker: str, exchange: str = "NSE") -> dict[str, Any]:
        if not self.settings.news_api_key:
            return {"articles": [], "errors": ["news_api_key_missing"], "sources_tried": []}

        symbol = ticker.upper().strip()
        company = resolve_company_name(symbol)
        from_date = (datetime.now(tz=timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
        articles: list[dict[str, Any]] = []
        errors: list[str] = []
        sources_tried: list[str] = []

        async with httpx.AsyncClient(timeout=25) as client:
            for query in build_news_queries(symbol, exchange):
                if len(articles) >= 15:
                    break
                batch, batch_errors, source = await self._fetch_everything(
                    client, query=query, from_date=from_date
                )
                sources_tried.append(source)
                errors.extend(batch_errors)
                articles.extend(batch)

            if len(articles) < 5:
                batch, batch_errors, source = await self._fetch_top_headlines_india(
                    client, company=company, symbol=symbol
                )
                sources_tried.append(source)
                errors.extend(batch_errors)
                articles.extend(batch)

        deduped = _dedupe_articles(articles)[:15]
        if not deduped:
            errors.append("no_news_articles_from_newsapi")

        return {
            "articles": deduped,
            "errors": errors,
            "sources_tried": sources_tried,
            "company_name": company,
        }

    async def _fetch_everything(
        self,
        client: httpx.AsyncClient,
        *,
        query: str,
        from_date: str,
    ) -> tuple[list[dict[str, Any]], list[str], str]:
        source = f"newsapi_everything:{query}"
        try:
            response = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": query,
                    "language": "en",
                    "sortBy": "publishedAt",
                    "from": from_date,
                    "pageSize": 15,
                    "apiKey": self.settings.news_api_key,
                },
            )
            if response.status_code == 426:
                return [], ["news_api_error:426:Developer plan cannot use this endpoint in production"], source
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            return [], [f"news_fetch_http_error: {exc.response.status_code}"], source
        except Exception as exc:
            return [], [f"news_fetch_failed: {exc}"], source

        articles, errors = _parse_newsapi_payload(data)
        return articles, errors, source

    async def _fetch_top_headlines_india(
        self,
        client: httpx.AsyncClient,
        *,
        company: str,
        symbol: str,
    ) -> tuple[list[dict[str, Any]], list[str], str]:
        source = f"newsapi_top_headlines_in:{company}"
        try:
            response = await client.get(
                "https://newsapi.org/v2/top-headlines",
                params={
                    "country": "in",
                    "category": "business",
                    "q": company if company != symbol else symbol,
                    "pageSize": 15,
                    "apiKey": self.settings.news_api_key,
                },
            )
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            return [], [f"news_top_headlines_failed: {exc}"], source

        articles, errors = _parse_newsapi_payload(data)
        return articles, errors, source
