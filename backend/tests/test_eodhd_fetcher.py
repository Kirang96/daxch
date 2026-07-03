import asyncio
from types import SimpleNamespace
from unittest.mock import patch

from backend.app.services.analysis.data.eodhd.fetcher import EodhdDataFetcher
from backend.app.services.analysis.data.eodhd.symbols import to_eodhd_symbol


def test_to_eodhd_symbol_nse_and_bse():
    assert to_eodhd_symbol("reliance", "NSE") == "RELIANCE.NSE"
    assert to_eodhd_symbol("TCS", "BSE") == "TCS.BSE"
    assert to_eodhd_symbol("RELIANCE.NSE", "NSE") == "RELIANCE.NSE"


def test_fetch_returns_error_when_api_key_missing():
    fetcher = EodhdDataFetcher()
    fetcher.client.settings = SimpleNamespace(eodhd_api_key="")
    result = asyncio.run(fetcher.fetch("RELIANCE", "NSE"))
    assert result["errors"] == ["eodhd_api_key_missing"]
    assert result["api_calls"] == 0
    assert result["symbol"] == "RELIANCE.NSE"


def test_fetch_normalizes_endpoints():
    fetcher = EodhdDataFetcher()

    async def fake_get(path: str, *, params=None):
        if path.startswith("fundamentals/"):
            if params and params.get("filter") == "Financials":
                return {
                    "Financials": {
                        "Income_Statement": {
                            "yearly": {
                                "2023": {
                                    "totalRevenue": 100000,
                                    "netIncome": 12000,
                                }
                            }
                        },
                        "Balance_Sheet": {
                            "yearly": {
                                "2023": {
                                    "totalDebt": 50000,
                                    "totalStockholderEquity": 200000,
                                }
                            }
                        },
                    }
                }
            return {
                "General": {
                    "Name": "Reliance Industries Ltd",
                    "Code": "RELIANCE",
                    "Exchange": "NSE",
                    "Sector": "Energy",
                },
                "Highlights": {"MarketCapitalization": 1.5e12, "PERatio": 25.5},
                "Valuation": {"TrailingPE": 25.5, "PriceBookMRQ": 2.1},
                "Technicals": {"Beta": 1.1, "52WeekHigh": 3000, "52WeekLow": 2200},
                "SplitsDividends": {"ForwardAnnualDividendYield": 0.003},
                "SharesStats": {"SharesOutstanding": 6760000000},
            }
        if path == "news":
            return [
                {
                    "title": "Reliance beats estimates",
                    "content": "Strong quarterly results",
                    "date": "2024-06-01",
                    "link": "https://example.com/news",
                    "sentiment": {"polarity": 0.8, "pos": 0.9, "neg": 0.1, "neu": 0.0},
                }
            ]
        if path == "sentiments":
            return {"RELIANCE.NSE": [{"date": "2024-06-01", "normalized": 0.6, "count": 12}]}
        if path == "calendar/earnings":
            return [{"report_date": "2024-07-15", "estimate": 12.5}]
        if path == "calendar/dividends":
            return [{"date": "2024-08-01", "value": 9.0}]
        if path == "calendar/splits":
            return []
        if path == "macro-indicator/IND":
            return [
                {
                    "Indicator": "gdp_growth_annual",
                    "Country": "India",
                    "Date": "2024-01-01",
                    "Value": 6.5,
                }
            ]
        if path.startswith("eod/"):
            return [
                {
                    "date": "2024-06-01",
                    "open": 2500,
                    "high": 2550,
                    "low": 2480,
                    "close": 2520,
                    "volume": 1000000,
                }
            ]
        raise AssertionError(f"unexpected path: {path}")

    with patch.object(fetcher.client, "get", side_effect=fake_get):
        fetcher.client.settings = SimpleNamespace(eodhd_api_key="test-token")
        result = asyncio.run(fetcher.fetch("RELIANCE", "NSE", include_eod=True))

    assert result["symbol"] == "RELIANCE.NSE"
    assert result["company"]["name"] == "Reliance Industries Ltd"
    assert result["highlights"]["pe_ratio"] == 25.5
    assert result["price_context"]["beta"] == 1.1
    assert result["financials_summary"]["fiscal_year"] == "2023"
    assert result["financials_summary"]["debt_to_equity"] == 0.25
    assert len(result["news_articles"]) == 1
    assert result["news_articles"][0]["origin"] == "eodhd"
    assert result["news_articles"][0]["sentiment"]["polarity"] == 0.8
    assert result["sentiment_trend"][0]["normalized"] == 0.6
    assert result["upcoming_earnings"][0]["report_date"] == "2024-07-15"
    assert len(result["macro_india"]) >= 1
    assert len(result["eod_candles"]) == 1
    assert result["api_calls"] >= 7
