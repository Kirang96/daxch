from __future__ import annotations

import math
from typing import Final

USD_PER_AI_UNIT: Final[float] = 0.0001
TAVILY_USD_PER_CREDIT: Final[float] = 0.008
TRADING_DAYS_PER_MONTH: Final[int] = 22

MODEL_INPUT_RATE_USD_PER_M: dict[str, float] = {
    "gpt-4o-mini": 0.15,
    "gpt-4o": 2.50,
    "gpt-4.1-mini": 0.40,
    "gpt-4.1": 2.00,
}

MODEL_OUTPUT_RATE_USD_PER_M: dict[str, float] = {
    "gpt-4o-mini": 0.60,
    "gpt-4o": 10.00,
    "gpt-4.1-mini": 1.60,
    "gpt-4.1": 8.00,
}

# Token estimates for monitoring UI (gpt-4o-mini baseline profile).
MONITORING_ESTIMATE_TOKENS: dict[str, tuple[int, int]] = {
    "gpt-4o-mini": (500, 150),
    "gpt-4o": (500, 150),
    "gpt-4.1-mini": (500, 150),
    "gpt-4.1": (500, 150),
}


def _model_rates(model: str) -> tuple[float, float]:
    return (
        MODEL_INPUT_RATE_USD_PER_M.get(model, MODEL_INPUT_RATE_USD_PER_M["gpt-4o-mini"]),
        MODEL_OUTPUT_RATE_USD_PER_M.get(model, MODEL_OUTPUT_RATE_USD_PER_M["gpt-4o-mini"]),
    )


def compute_units(
    *,
    prompt_tokens: int,
    completion_tokens: int,
    model: str,
    tavily_credits: int = 0,
) -> int:
    input_rate, output_rate = _model_rates(model)
    llm_usd = (prompt_tokens / 1_000_000) * input_rate + (completion_tokens / 1_000_000) * output_rate
    tavily_usd = tavily_credits * TAVILY_USD_PER_CREDIT
    total_usd = llm_usd + tavily_usd
    if total_usd <= 0:
        return 0
    return max(1, math.ceil(total_usd / USD_PER_AI_UNIT))


def tavily_credits_to_units(credits: int) -> int:
    if credits <= 0:
        return 0
    return max(1, math.ceil((credits * TAVILY_USD_PER_CREDIT) / USD_PER_AI_UNIT))


def estimate_monitoring_units_per_poll(model: str) -> int:
    prompt_tokens, completion_tokens = MONITORING_ESTIMATE_TOKENS.get(
        model, MONITORING_ESTIMATE_TOKENS["gpt-4o-mini"]
    )
    return compute_units(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, model=model)


def estimate_portfolio_monthly_units(*, total_daily_polls: int, model: str) -> int:
    per_poll = estimate_monitoring_units_per_poll(model)
    return per_poll * TRADING_DAYS_PER_MONTH * max(0, total_daily_polls)
