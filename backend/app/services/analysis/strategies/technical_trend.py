import json

from backend.app.services.analysis.prompts import TECHNICAL_TREND_PROMPT
from backend.app.services.analysis.schemas import LLMStrategyOutput, StrategyId
from backend.app.services.analysis.strategies.base import AnalysisStrategy


class TechnicalTrendStrategy(AnalysisStrategy):
    id = StrategyId.technical_trend
    name = "Technical Trend"
    description = "Analyze price action and technical indicators only. Ignores news."
    min_plan = "starter"

    def required_data_types(self) -> set[str]:
        return {"market"}

    def build_prompt(self, context: dict) -> str:
        return TECHNICAL_TREND_PROMPT.format(
            ticker=context["ticker"],
            current_price=context["current_price"],
            planned_entry_price=context.get("planned_entry_price", "not_provided"),
            planned_quantity=context.get("planned_quantity", 0),
            technical_data=json.dumps(context.get("technical_data", {})),
        )

    def safe_fallback(self, ticker: str, reason: str = "") -> LLMStrategyOutput:
        return LLMStrategyOutput(
            decision_type="dont_enter",
            confidence=0.4,
            reasoning=f"Technical analysis unavailable for {ticker}. {reason}".strip(),
            quantity_delta=0,
            risk_flags=["LLM_PARSE_FAILED", "DATA_UNAVAILABLE"],
        )
