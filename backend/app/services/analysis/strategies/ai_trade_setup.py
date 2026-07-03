import json

from backend.app.services.analysis.prompts import AI_TRADE_SETUP_PROMPT
from backend.app.services.analysis.schemas import LLMStrategyOutput, StrategyId
from backend.app.services.analysis.strategies.base import AnalysisStrategy


class AITradeSetupStrategy(AnalysisStrategy):
    id = StrategyId.ai_trade_setup
    name = "AI Trade Setup"
    description = "Combine technicals and news for an actionable swing-trade setup."
    min_plan = "pro"

    def required_data_types(self) -> set[str]:
        return {"market", "news", "web_search", "eodhd"}

    def build_prompt(self, context: dict) -> str:
        return AI_TRADE_SETUP_PROMPT.format(
            ticker=context["ticker"],
            current_price=context["current_price"],
            planned_entry_price=context.get("planned_entry_price", "not_provided"),
            planned_quantity=context.get("planned_quantity", 0),
            intention=context.get("intention", "long_term"),
            technical_data=json.dumps(context.get("technical_data", {})),
            news_summary=json.dumps(context.get("news_articles", [])),
            web_search_results=json.dumps(context.get("web_search_results", [])),
            volatility=json.dumps(context.get("volatility", {})),
            eodhd=json.dumps(context.get("eodhd", {})),
        )

    def safe_fallback(self, ticker: str, reason: str = "") -> LLMStrategyOutput:
        return LLMStrategyOutput(
            decision_type="dont_enter",
            confidence=0.3,
            reasoning=f"Trade setup analysis unavailable for {ticker}. {reason}".strip(),
            quantity_delta=0,
            risk_flags=["LLM_PARSE_FAILED", "LOW_CONVICTION", "DATA_UNAVAILABLE"],
        )
