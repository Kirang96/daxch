from abc import ABC, abstractmethod
from typing import Any

from backend.app.services.analysis.schemas import LLMStrategyOutput, StrategyId


class AnalysisStrategy(ABC):
    id: StrategyId
    name: str
    description: str
    min_plan: str  # "starter" | "pro"

    @abstractmethod
    def required_data_types(self) -> set[str]:
        """Return set of: market, news, web_search"""

    @abstractmethod
    def build_prompt(self, context: dict[str, Any]) -> str:
        ...

    @abstractmethod
    def safe_fallback(self, ticker: str, reason: str = "") -> LLMStrategyOutput:
        ...
