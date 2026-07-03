from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from backend.app.services.analysis.data.eodhd.client import EodhdClient, EodhdFetchError
from backend.app.services.analysis.data.eodhd.symbols import to_eodhd_symbol
from backend.app.services.broker.base import CandleBar

_MACRO_CACHE: dict[str, tuple[datetime, list[dict[str, Any]]]] = {}
_MACRO_CACHE_TTL = timedelta(hours=24)

_MACRO_INDICATORS_OF_INTEREST = {
    "gdp_current_usd",
    "gdp_growth_annual",
    "inflation_consumer_prices_annual",
    "unemployment_total_percent",
    "real_interest_rate",
    "current_account_balance_usd",
}


def _safe_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_company(general: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": general.get("Name") or general.get("Code"),
        "code": general.get("Code"),
        "exchange": general.get("Exchange"),
        "currency": general.get("CurrencyCode") or general.get("CurrencyName"),
        "country": general.get("CountryName"),
        "sector": general.get("Sector"),
        "industry": general.get("Industry"),
        "description": (general.get("Description") or "")[:500] or None,
        "employees": general.get("FullTimeEmployees"),
        "website": general.get("WebURL"),
    }


def _normalize_highlights(highlights: dict[str, Any]) -> dict[str, Any]:
    return {
        "market_cap": _safe_float(highlights.get("MarketCapitalization")),
        "pe_ratio": _safe_float(highlights.get("PERatio")),
        "peg_ratio": _safe_float(highlights.get("PEGRatio")),
        "eps": _safe_float(highlights.get("EarningsShare")),
        "dividend_yield": _safe_float(highlights.get("DividendYield")),
        "profit_margin": _safe_float(highlights.get("ProfitMargin")),
        "roe": _safe_float(highlights.get("ReturnOnEquityTTM")),
        "revenue_ttm": _safe_float(highlights.get("RevenueTTM")),
        "book_value": _safe_float(highlights.get("BookValue")),
    }


def _normalize_valuation(valuation: dict[str, Any]) -> dict[str, Any]:
    return {
        "trailing_pe": _safe_float(valuation.get("TrailingPE")),
        "forward_pe": _safe_float(valuation.get("ForwardPE")),
        "price_sales": _safe_float(valuation.get("PriceSalesTTM")),
        "price_book": _safe_float(valuation.get("PriceBookMRQ")),
        "enterprise_value": _safe_float(valuation.get("EnterpriseValue")),
        "ev_revenue": _safe_float(valuation.get("EnterpriseValueRevenue")),
        "ev_ebitda": _safe_float(valuation.get("EnterpriseValueEbitda")),
    }


def _normalize_price_context(technicals: dict[str, Any]) -> dict[str, Any]:
    return {
        "beta": _safe_float(technicals.get("Beta")),
        "week_52_high": _safe_float(technicals.get("52WeekHigh")),
        "week_52_low": _safe_float(technicals.get("52WeekLow")),
        "ma_50": _safe_float(technicals.get("50DayMA")),
        "ma_200": _safe_float(technicals.get("200DayMA")),
    }


def _normalize_dividends(splits_div: dict[str, Any]) -> dict[str, Any]:
    return {
        "forward_annual_dividend_rate": _safe_float(splits_div.get("ForwardAnnualDividendRate")),
        "forward_annual_dividend_yield": _safe_float(splits_div.get("ForwardAnnualDividendYield")),
        "payout_ratio": _safe_float(splits_div.get("PayoutRatio")),
        "dividend_date": splits_div.get("DividendDate"),
        "ex_dividend_date": splits_div.get("ExDividendDate"),
        "last_split_factor": splits_div.get("LastSplitFactor"),
        "last_split_date": splits_div.get("LastSplitDate"),
    }


def _normalize_shares(shares: dict[str, Any]) -> dict[str, Any]:
    return {
        "shares_outstanding": _safe_float(shares.get("SharesOutstanding")),
        "shares_float": _safe_float(shares.get("SharesFloat")),
        "percent_insiders": _safe_float(shares.get("PercentInsiders")),
        "percent_institutions": _safe_float(shares.get("PercentInstitutions")),
    }


def _summarize_financials(financials: dict[str, Any]) -> dict[str, Any]:
    income = financials.get("Income_Statement") or financials.get("IncomeStatement") or {}
    balance = financials.get("Balance_Sheet") or financials.get("BalanceSheet") or {}
    yearly_income = (income.get("yearly") or {}) if isinstance(income, dict) else {}
    yearly_balance = (balance.get("yearly") or {}) if isinstance(balance, dict) else {}

    latest_year = None
    if yearly_income:
        years = sorted(yearly_income.keys(), reverse=True)
        latest_year = years[0] if years else None

    latest_income = yearly_income.get(latest_year, {}) if latest_year else {}
    latest_balance = yearly_balance.get(latest_year, {}) if latest_year else {}

    total_debt = _safe_float(latest_balance.get("totalDebt") or latest_balance.get("shortLongTermDebtTotal"))
    total_equity = _safe_float(latest_balance.get("totalStockholderEquity"))

    return {
        "fiscal_year": latest_year,
        "total_revenue": _safe_float(latest_income.get("totalRevenue")),
        "net_income": _safe_float(latest_income.get("netIncome")),
        "gross_profit": _safe_float(latest_income.get("grossProfit")),
        "operating_income": _safe_float(latest_income.get("operatingIncome")),
        "total_debt": total_debt,
        "total_equity": total_equity,
        "debt_to_equity": round(total_debt / total_equity, 2) if total_debt and total_equity else None,
    }


def _normalize_news(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        content = (item.get("content") or "").strip()
        if not title and not content:
            continue
        sentiment = item.get("sentiment") or {}
        articles.append(
            {
                "title": title or content[:120],
                "source": "eodhd",
                "published_at": item.get("date", ""),
                "summary": content[:600] if content else title,
                "url": item.get("link", ""),
                "origin": "eodhd",
                "sentiment": {
                    "polarity": _safe_float(sentiment.get("polarity")),
                    "positive": _safe_float(sentiment.get("pos")),
                    "negative": _safe_float(sentiment.get("neg")),
                    "neutral": _safe_float(sentiment.get("neu")),
                },
            }
        )
    return articles


def _normalize_sentiment_trend(raw: dict[str, Any] | list[Any], symbol: str) -> list[dict[str, Any]]:
    rows = raw.get(symbol) if isinstance(raw, dict) else raw
    if not isinstance(rows, list):
        return []
    return [
        {
            "date": row.get("date"),
            "normalized": _safe_float(row.get("normalized")),
            "count": row.get("count"),
        }
        for row in rows
        if isinstance(row, dict)
    ]


def _normalize_calendar_rows(rows: list[dict[str, Any]], *, limit: int = 5) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for row in rows or []:
        if not isinstance(row, dict):
            continue
        normalized.append({k: v for k, v in row.items() if v is not None})
    return normalized[:limit]


def _eod_to_candles(raw: list[dict[str, Any]]) -> list[CandleBar]:
    bars: list[CandleBar] = []
    for row in raw or []:
        if not isinstance(row, dict):
            continue
        try:
            bars.append(
                CandleBar(
                    timestamp=str(row.get("date", "")),
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=float(row.get("volume") or 0),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return bars[-250:]


def _normalize_macro(raw: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for row in raw or []:
        if not isinstance(row, dict):
            continue
        indicator = str(row.get("Indicator") or row.get("indicator") or "").lower()
        key = indicator.replace(" ", "_").replace("%", "percent")
        if _MACRO_INDICATORS_OF_INTEREST and key not in _MACRO_INDICATORS_OF_INTEREST:
            if not any(interest in key for interest in ("gdp", "inflation", "unemployment", "interest")):
                continue
        result.append(
            {
                "indicator": row.get("Indicator") or row.get("indicator"),
                "country": row.get("Country") or row.get("country"),
                "date": row.get("Date") or row.get("date"),
                "value": _safe_float(row.get("Value") or row.get("value")),
            }
        )
    return result[:12]


class EodhdDataFetcher:
    def __init__(self) -> None:
        self.client = EodhdClient()

    async def fetch(self, ticker: str, exchange: str = "NSE", *, include_eod: bool = False) -> dict[str, Any]:
        if not self.client.api_token:
            return {
                "symbol": to_eodhd_symbol(ticker, exchange),
                "errors": ["eodhd_api_key_missing"],
                "api_calls": 0,
            }

        symbol = to_eodhd_symbol(ticker, exchange)
        today = datetime.now(tz=timezone.utc).date()
        from_14d = (today - timedelta(days=14)).isoformat()
        from_400d = (today - timedelta(days=400)).isoformat()
        to_date = today.isoformat()

        tasks = {
            "fundamentals_core": self._fetch_fundamentals(
                symbol,
                filter_sections="General,Highlights,Valuation,Technicals,SplitsDividends,SharesStats",
            ),
            "fundamentals_financials": self._fetch_fundamentals(symbol, filter_sections="Financials"),
            "news": self._fetch_news(symbol),
            "sentiments": self._fetch_sentiments(symbol, from_14d, to_date),
            "earnings": self._fetch_calendar("calendar/earnings", symbol, from_14d, to_date),
            "dividends": self._fetch_calendar("calendar/dividends", symbol, from_14d, to_date),
            "splits": self._fetch_calendar("calendar/splits", symbol, from_400d, to_date),
            "macro": self._fetch_macro_india(),
        }
        if include_eod:
            tasks["eod"] = self._fetch_eod(symbol, from_400d)

        keys = list(tasks.keys())
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)

        errors: list[str] = []
        api_calls = 0
        payloads: dict[str, Any] = {}

        for key, result in zip(keys, results):
            if isinstance(result, Exception):
                errors.append(f"eodhd_{key}: {result}")
                payloads[key] = None
                continue
            data, calls = result
            api_calls += calls
            payloads[key] = data
            if data is None and key != "macro":
                errors.append(f"eodhd_{key}_empty")

        core = payloads.get("fundamentals_core") or {}
        financials_raw = payloads.get("fundamentals_financials") or {}

        earnings_rows = _normalize_calendar_rows(_extract_calendar_rows(payloads.get("earnings")))
        dividends_rows = _normalize_calendar_rows(_extract_calendar_rows(payloads.get("dividends")))
        splits_rows = _normalize_calendar_rows(_extract_calendar_rows(payloads.get("splits")))

        eod_candles: list[CandleBar] = []
        if include_eod and payloads.get("eod"):
            eod_candles = _eod_to_candles(payloads["eod"])

        return {
            "symbol": symbol,
            "company": _normalize_company(core.get("General") or {}),
            "highlights": _normalize_highlights(core.get("Highlights") or {}),
            "valuation": _normalize_valuation(core.get("Valuation") or {}),
            "price_context": _normalize_price_context(core.get("Technicals") or {}),
            "dividends": _normalize_dividends(core.get("SplitsDividends") or {}),
            "shares": _normalize_shares(core.get("SharesStats") or {}),
            "financials_summary": _summarize_financials(financials_raw.get("Financials") or financials_raw),
            "news_articles": _normalize_news(payloads.get("news") or []),
            "sentiment_trend": _normalize_sentiment_trend(payloads.get("sentiments") or {}, symbol),
            "upcoming_earnings": earnings_rows,
            "upcoming_dividends": dividends_rows,
            "recent_splits": splits_rows,
            "macro_india": payloads.get("macro") or [],
            "eod_candles": eod_candles,
            "errors": errors,
            "api_calls": api_calls,
        }

    async def _fetch_fundamentals(self, symbol: str, *, filter_sections: str) -> tuple[dict[str, Any] | None, int]:
        try:
            data = await self.client.get(f"fundamentals/{symbol}", params={"filter": filter_sections})
        except EodhdFetchError:
            raise
        if not isinstance(data, dict):
            return None, 1
        return data, 1

    async def _fetch_news(self, symbol: str) -> tuple[list[dict[str, Any]] | None, int]:
        data = await self.client.get("news", params={"s": symbol, "limit": 10})
        if isinstance(data, list):
            return data, 1
        return [], 1

    async def _fetch_sentiments(self, symbol: str, from_date: str, to_date: str) -> tuple[Any, int]:
        data = await self.client.get(
            "sentiments",
            params={"s": symbol, "from": from_date, "to": to_date},
        )
        return data, 1

    async def _fetch_calendar(
        self,
        path: str,
        symbol: str,
        from_date: str,
        to_date: str,
    ) -> tuple[Any, int]:
        data = await self.client.get(
            path,
            params={"symbols": symbol, "from": from_date, "to": to_date},
        )
        return data, 1

    async def _fetch_macro_india(self) -> tuple[list[dict[str, Any]], int]:
        cache_key = "IND"
        cached = _MACRO_CACHE.get(cache_key)
        now = datetime.now(tz=timezone.utc)
        if cached and now - cached[0] < _MACRO_CACHE_TTL:
            return cached[1], 0

        try:
            data = await self.client.get("macro-indicator/IND")
        except EodhdFetchError:
            return [], 0

        normalized = _normalize_macro(data if isinstance(data, list) else [])
        _MACRO_CACHE[cache_key] = (now, normalized)
        return normalized, 1

    async def _fetch_eod(self, symbol: str, from_date: str) -> tuple[list[dict[str, Any]] | None, int]:
        data = await self.client.get(
            f"eod/{symbol}",
            params={"from": from_date, "period": "d", "order": "a"},
        )
        if isinstance(data, list):
            return data, 1
        return [], 1


def _extract_calendar_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("earnings", "dividends", "splits", "data"):
            rows = payload.get(key)
            if isinstance(rows, list):
                return rows
    return []
