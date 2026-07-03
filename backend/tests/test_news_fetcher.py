from backend.app.services.analysis.data.company_names import build_news_queries, resolve_company_name
from backend.app.services.analysis.data.news import _parse_newsapi_payload
from backend.app.services.analysis.data.news_context import merge_news_and_search, merge_news_sources


def test_resolve_company_name():
    assert resolve_company_name("RELIANCE") == "Reliance Industries"
    assert resolve_company_name("UNKNOWN") == "UNKNOWN"


def test_build_news_queries_includes_company():
    queries = build_news_queries("RELIANCE", "NSE")
    assert any("Reliance Industries" in q for q in queries)


def test_parse_newsapi_error_status():
    articles, errors = _parse_newsapi_payload(
        {"status": "error", "code": "rateLimited", "message": "Too many requests"}
    )
    assert articles == []
    assert errors[0].startswith("news_api_error:")


def test_merge_news_and_search_combines_sources():
    news_data = {
        "articles": [
            {
                "title": "Reliance Q4 results",
                "source": "Mint",
                "published_at": "2024-01-01",
                "summary": "Beat estimates",
                "url": "https://example.com/1",
                "origin": "newsapi",
            }
        ],
        "company_name": "Reliance Industries",
    }
    search_data = {
        "results": [
            {
                "title": "Reliance expansion plan",
                "snippet": "New retail push",
                "url": "https://example.com/2",
                "source": "tavily",
            }
        ]
    }
    merged, stats = merge_news_and_search(news_data, search_data)
    assert len(merged) == 2
    assert stats["merged_count"] == 2
    assert stats["newsapi_count"] == 1
    assert stats["tavily_count"] == 1


def test_merge_news_sources_eodhd_first_and_dedupes():
    eodhd = [
        {
            "title": "Reliance Q4 results",
            "source": "eodhd",
            "published_at": "2024-01-01",
            "summary": "Beat estimates",
            "url": "https://example.com/eodhd",
            "origin": "eodhd",
        }
    ]
    news_data = {
        "articles": [
            {
                "title": "Reliance Q4 Results",
                "source": "Mint",
                "published_at": "2024-01-02",
                "summary": "Duplicate headline",
                "url": "https://example.com/newsapi",
                "origin": "newsapi",
            },
            {
                "title": "Reliance expansion plan",
                "source": "Mint",
                "published_at": "2024-01-03",
                "summary": "New retail push",
                "url": "https://example.com/unique",
                "origin": "newsapi",
            },
        ]
    }
    merged, stats = merge_news_sources(
        eodhd_articles=eodhd,
        news_data=news_data,
        search_data={"results": []},
        sentiment_trend=[{"date": "2024-01-01", "normalized": 0.5}],
    )
    assert len(merged) == 2
    assert merged[0]["origin"] == "eodhd"
    assert stats["eodhd_count"] == 1
    assert stats["newsapi_count"] == 2
    assert stats["sentiment_trend_days"] == 1
