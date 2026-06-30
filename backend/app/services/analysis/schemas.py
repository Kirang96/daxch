from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from backend.app.services.ai.prompts import ANALYSIS_DISCLAIMER


class StrategyId(str, Enum):
    technical_trend = "technical_trend"
    news_sentiment = "news_sentiment"
    ai_trade_setup = "ai_trade_setup"


ENTRY_DECISIONS = frozenset({"enter", "dont_enter"})


class StrategyMeta(BaseModel):
    id: str
    name: str
    description: str
    min_plan: Literal["starter", "pro"]
    available: bool = False


class LLMStrategyOutput(BaseModel):
    decision_type: str
    confidence: float
    reasoning: str
    quantity_delta: int
    risk_flags: list[str] = Field(default_factory=list)

    @field_validator("decision_type")
    @classmethod
    def validate_decision(cls, v: str) -> str:
        normalized = v.strip().lower().replace(" ", "_").replace("'", "")
        if normalized in ENTRY_DECISIONS:
            return normalized
        if normalized in ("buy", "buy_more", "accumulate", "enter", "yes"):
            return "enter"
        if normalized in (
            "sell",
            "exit",
            "reduce",
            "hold",
            "wait",
            "dont_enter",
            "dontenter",
            "do_not_enter",
            "no",
            "skip",
            "pass",
        ):
            return "dont_enter"
        return "dont_enter"

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, v: float) -> float:
        return max(0.0, min(1.0, float(v)))

    @field_validator("quantity_delta", mode="before")
    @classmethod
    def coerce_quantity(cls, v: Any) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 0

    @field_validator("risk_flags", mode="before")
    @classmethod
    def coerce_flags(cls, v: Any) -> list[str]:
        if not v:
            return []
        if isinstance(v, list):
            return [str(f).upper().replace(" ", "_") for f in v if f]
        return [str(v).upper()]


class StrategyAnalysisResult(BaseModel):
    strategy: str
    ticker: str
    decision_type: Literal["enter", "dont_enter"]
    confidence: float
    reasoning: str
    quantity_delta: int
    risk_flags: list[str] = Field(default_factory=list)
    disclaimer: str = ANALYSIS_DISCLAIMER
    metadata: dict[str, Any] = Field(default_factory=dict)
    suggested_entry: float | None = None
    signal: str | None = None
    suggested_polling_frequency: int | None = None
    frequency_rationale: str | None = None
    frequency_factors: list[str] = Field(default_factory=list)
    max_adoptable_polling_frequency: int = 12

    @classmethod
    def from_llm_output(
        cls,
        *,
        strategy: str,
        ticker: str,
        output: LLMStrategyOutput,
        metadata: dict[str, Any] | None = None,
        suggested_entry: float | None = None,
        signal: str | None = None,
        suggested_polling_frequency: int | None = None,
        frequency_rationale: str | None = None,
        frequency_factors: list[str] | None = None,
        max_adoptable_polling_frequency: int = 12,
    ) -> "StrategyAnalysisResult":
        return cls(
            strategy=strategy,
            ticker=ticker,
            decision_type=output.decision_type,  # type: ignore[arg-type]
            confidence=output.confidence,
            reasoning=output.reasoning,
            quantity_delta=output.quantity_delta,
            risk_flags=output.risk_flags,
            metadata=metadata or {},
            suggested_entry=suggested_entry,
            signal=signal,
            suggested_polling_frequency=suggested_polling_frequency,
            frequency_rationale=frequency_rationale,
            frequency_factors=frequency_factors or [],
            max_adoptable_polling_frequency=max_adoptable_polling_frequency,
        )
