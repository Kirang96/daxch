from typing import Any

from backend.app.services.analysis.data.market import MarketDataFetcher
from backend.app.services.analysis.data.news import NewsDataFetcher
from backend.app.services.analysis.data.news_context import merge_news_and_search
from backend.app.services.analysis.data.web_search import TavilySearchFetcher
from backend.app.services.analysis.indicators.bundle import compute_technical_bundle
from backend.app.services.analysis.monitoring_recommendations import suggest_entry, suggest_entry_rationale, suggest_polling_frequency
from backend.app.services.analysis.llm_client import LLMJsonClient
from backend.app.services.analysis.registry import StrategyRegistry
from backend.app.services.analysis.schemas import StrategyAnalysisResult, StrategyId
from backend.app.services.broker.base import BaseBroker


class AnalysisPipeline:
    def __init__(self) -> None:
        self.market_fetcher = MarketDataFetcher()
        self.news_fetcher = NewsDataFetcher()
        self.search_fetcher = TavilySearchFetcher()
        self.llm = LLMJsonClient()

    async def run(
        self,
        *,
        strategy_id: str,
        ticker: str,
        exchange: str,
        broker: BaseBroker,
        access_token: str,
        intention: str = "long_term",
        quantity: int | None = None,
        capital: float | None = None,
        current_price: float | None = None,
        planned_entry_price: float | None = None,
        user_polling_frequency: int = 2,
        max_adoptable_frequency: int = 12,
        ai_model: str | None = None,
    ) -> StrategyAnalysisResult:
        strategy = StrategyRegistry.get(strategy_id)
        required = strategy.required_data_types()
        data_gaps: list[str] = []
        metadata: dict[str, Any] = {"data_gaps": data_gaps}

        market_data: dict[str, Any] = {}
        news_data: dict[str, Any] = {"articles": []}
        search_data: dict[str, Any] = {"results": [], "tavily_credits": 0}

        if "market" in required:
            market_data = await self.market_fetcher.fetch(
                broker,
                ticker=ticker,
                exchange=exchange,
                access_token=access_token,
            )
            if market_data.get("errors"):
                data_gaps.extend(market_data["errors"])

        if "news" in required:
            news_data = await self.news_fetcher.fetch(ticker, exchange)
            if news_data.get("errors"):
                data_gaps.extend(news_data["errors"])

        if "web_search" in required:
            search_data = await self.search_fetcher.fetch(ticker, exchange)
            if search_data.get("errors"):
                data_gaps.extend(search_data["errors"])
            metadata["tavily_credits"] = search_data.get("tavily_credits", 0)

        merged_articles, news_stats = merge_news_and_search(news_data, search_data)
        metadata["news_stats"] = news_stats
        if "news" in required or "web_search" in required:
            if not merged_articles:
                data_gaps.append("no_news_articles")

        quote = market_data.get("quote")
        candles = market_data.get("candles") or []
        price = current_price
        if price is None and quote is not None:
            price = quote.ltp

        if "market" not in required and price is None:
            try:
                quote = await broker.get_quote(
                    ticker=ticker.upper(),
                    exchange=exchange,
                    access_token=access_token,
                )
                price = quote.ltp
            except Exception as exc:
                data_gaps.append(f"quote: {exc}")

        if price is None:
            price = 0.0

        planned_quantity = quantity or 0
        if not planned_quantity and capital and price > 0:
            planned_quantity = max(1, int(capital / price))

        technical_data: dict[str, Any] = {}
        volatility: dict[str, Any] = {}
        if candles:
            technical_data = compute_technical_bundle(candles, current_price=price)
            volatility = {
                "atr_14": technical_data.get("atr_14"),
                "bollinger_bandwidth": (technical_data.get("bollinger") or {}).get("bandwidth"),
                "trend": technical_data.get("trend"),
            }
        elif "market" in required:
            data_gaps.append("no_candle_data")

        context: dict[str, Any] = {
            "ticker": ticker.upper(),
            "exchange": exchange.upper(),
            "current_price": price,
            "planned_entry_price": planned_entry_price if planned_entry_price is not None else "not_provided",
            "planned_quantity": planned_quantity,
            "intention": intention,
            "technical_data": technical_data,
            "news_articles": merged_articles,
            "web_search_results": search_data.get("results", []),
            "volatility": volatility,
        }

        prompt = strategy.build_prompt(context)
        llm_output, llm_meta = await self.llm.complete_strategy(
            strategy, ticker=ticker.upper(), prompt=prompt, model=ai_model
        )

        metadata.update(llm_meta)
        if data_gaps and "DATA_UNAVAILABLE" not in llm_output.risk_flags:
            llm_output.risk_flags.append("DATA_UNAVAILABLE")

        suggested_entry, signal = suggest_entry(
            price,
            llm_output.decision_type,
            technical_data,
            llm_output.risk_flags,
        )
        entry_rationale = suggest_entry_rationale(
            suggested_entry=suggested_entry,
            current_price=price,
            planned_entry_price=planned_entry_price,
            signal=signal,
            technical_data=technical_data,
        )
        suggested_freq, freq_rationale, freq_factors = suggest_polling_frequency(
            intention,
            technical_data,
            user_polling_frequency,
            llm_output.decision_type,
            llm_output.risk_flags,
        )

        return StrategyAnalysisResult.from_llm_output(
            strategy=strategy_id,
            ticker=ticker.upper(),
            output=llm_output,
            metadata=metadata,
            suggested_entry=suggested_entry,
            signal=signal,
            suggested_entry_rationale=entry_rationale,
            suggested_polling_frequency=suggested_freq,
            frequency_rationale=freq_rationale,
            frequency_factors=freq_factors,
            max_adoptable_polling_frequency=max_adoptable_frequency,
        )
