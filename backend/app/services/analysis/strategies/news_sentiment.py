import json

from backend.app.services.analysis.prompts import NEWS_SENTIMENT_PROMPT
from backend.app.services.analysis.schemas import LLMStrategyOutput, StrategyId
from backend.app.services.analysis.strategies.base import AnalysisStrategy


class NewsSentimentStrategy(AnalysisStrategy):
    id = StrategyId.news_sentiment
    name = "News & Sentiment"
    description = "Analyze recent news and public sentiment. Ignores chart patterns."
    min_plan = "starter"

    def required_data_types(self) -> set[str]:
        return {"news", "web_search"}

    def build_prompt(self, context: dict) -> str:
        return NEWS_SENTIMENT_PROMPT.format(
            ticker=context["ticker"],
            exchange=context.get("exchange", "NSE"),
            current_price=context["current_price"],
            planned_entry_price=context.get("planned_entry_price", "not_provided"),
            planned_quantity=context.get("planned_quantity", 0),
            news_articles=json.dumps(context.get("news_articles", [])),
            web_search_results=json.dumps(context.get("web_search_results", [])),
            intention=context.get("intention", "long_term"),
        )

    def safe_fallback(self, ticker: str, reason: str = "") -> LLMStrategyOutput:
        return LLMStrategyOutput(
            decision_type="dont_enter",
            confidence=0.35,
            reasoning=f"News sentiment analysis unavailable for {ticker}. {reason}".strip(),
            quantity_delta=0,
            risk_flags=["LLM_PARSE_FAILED", "DATA_UNAVAILABLE", "UNCERTAIN_INFORMATION"],
        )
