from __future__ import annotations

from datetime import date, datetime
from typing import Any


def _normalize_title(title: str) -> str:
    return " ".join(title.lower().split())


def _dedupe_articles(articles: list[dict[str, Any]], *, limit: int = 20) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for article in articles:
        key = _normalize_title(article.get("title") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(article)
    return merged[:limit]


def merge_news_sources(
    *,
    eodhd_articles: list[dict[str, Any]] | None = None,
    news_data: dict[str, Any] | None = None,
    search_data: dict[str, Any] | None = None,
    sentiment_trend: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Combine EODHD, NewsAPI, and Tavily into one deduped article list (EODHD first)."""
    news_data = news_data or {}
    search_data = search_data or {}
    articles: list[dict[str, Any]] = list(eodhd_articles or [])
    articles.extend(news_data.get("articles") or [])

    for item in search_data.get("results") or []:
        title = item.get("title", "").strip()
        snippet = item.get("snippet", "").strip()
        if not title and not snippet:
            continue
        articles.append(
            {
                "title": title or snippet[:120],
                "source": item.get("source") or "web_search",
                "published_at": "",
                "summary": snippet,
                "url": item.get("url", ""),
                "origin": "tavily",
            }
        )

    merged = _dedupe_articles(articles)
    stats = {
        "eodhd_count": len(eodhd_articles or []),
        "newsapi_count": len(news_data.get("articles") or []),
        "tavily_count": len(search_data.get("results") or []),
        "merged_count": len(merged),
        "sentiment_trend_days": len(sentiment_trend or []),
        "company_name": news_data.get("company_name"),
        "sources_tried": news_data.get("sources_tried") or [],
    }
    return merged, stats


def merge_news_and_search(
    news_data: dict[str, Any],
    search_data: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Backward-compatible wrapper."""
    return merge_news_sources(news_data=news_data, search_data=search_data)


def earnings_within_days(upcoming_earnings: list[dict[str, Any]], *, today: date | None = None) -> int | None:
    if not upcoming_earnings:
        return None
    ref = today or date.today()
    best: int | None = None
    for row in upcoming_earnings:
        raw = row.get("report_date") or row.get("date") or row.get("ReportDate")
        if not raw:
            continue
        try:
            report_date = date.fromisoformat(str(raw)[:10])
        except ValueError:
            try:
                report_date = datetime.fromisoformat(str(raw).replace("Z", "+00:00")).date()
            except ValueError:
                continue
        delta = (report_date - ref).days
        if delta < 0:
            continue
        if best is None or delta < best:
            best = delta
    return best


def build_eodhd_llm_context(eodhd_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "company": eodhd_data.get("company") or {},
        "highlights": eodhd_data.get("highlights") or {},
        "valuation": eodhd_data.get("valuation") or {},
        "financials_summary": eodhd_data.get("financials_summary") or {},
        "price_context": eodhd_data.get("price_context") or {},
        "dividends": eodhd_data.get("dividends") or {},
        "shares": eodhd_data.get("shares") or {},
        "sentiment_trend": eodhd_data.get("sentiment_trend") or [],
        "upcoming_earnings": eodhd_data.get("upcoming_earnings") or [],
        "upcoming_dividends": eodhd_data.get("upcoming_dividends") or [],
        "recent_splits": eodhd_data.get("recent_splits") or [],
        "macro_india": eodhd_data.get("macro_india") or [],
    }
