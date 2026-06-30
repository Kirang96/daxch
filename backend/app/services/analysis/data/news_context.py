from typing import Any


def merge_news_and_search(
    news_data: dict[str, Any],
    search_data: dict[str, Any],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Combine NewsAPI articles with Tavily web results for LLM prompts."""
    articles: list[dict[str, Any]] = list(news_data.get("articles") or [])
    search_results: list[dict[str, Any]] = list(search_data.get("results") or [])

    for item in search_results:
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

    # Dedupe by normalized title
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for article in articles:
        key = (article.get("title") or "").lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(article)

    stats = {
        "newsapi_count": len(news_data.get("articles") or []),
        "tavily_count": len(search_results),
        "merged_count": len(merged),
        "company_name": news_data.get("company_name"),
        "sources_tried": news_data.get("sources_tried") or [],
    }
    return merged[:20], stats
