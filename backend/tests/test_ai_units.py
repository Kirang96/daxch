import math

import pytest

from backend.app.services.ai_units.pricing import (
    TRADING_DAYS_PER_MONTH,
    compute_units,
    estimate_monitoring_units_per_poll,
    estimate_portfolio_monthly_units,
    tavily_credits_to_units,
)
from backend.app.services.ai_units.topup_packs import get_topup_pack, list_topup_packs
from backend.app.services.plan_limits import get_agent_limit, get_monthly_ai_units


def test_compute_units_gpt4o_mini() -> None:
    units = compute_units(prompt_tokens=1000, completion_tokens=200, model="gpt-4o-mini")
    expected = math.ceil((1000 / 1_000_000 * 0.15 + 200 / 1_000_000 * 0.60) / 0.0001)
    assert units == expected


def test_compute_units_gpt41_more_expensive() -> None:
    mini = compute_units(prompt_tokens=500, completion_tokens=150, model="gpt-4o-mini")
    full = compute_units(prompt_tokens=500, completion_tokens=150, model="gpt-4.1")
    assert full > mini


def test_tavily_credits_to_units() -> None:
    assert tavily_credits_to_units(1) == 80
    assert tavily_credits_to_units(3) == 240


def test_compute_units_includes_tavily() -> None:
    llm_only = compute_units(prompt_tokens=1000, completion_tokens=200, model="gpt-4o-mini", tavily_credits=0)
    with_tavily = compute_units(prompt_tokens=1000, completion_tokens=200, model="gpt-4o-mini", tavily_credits=3)
    assert with_tavily > llm_only


def test_plan_monthly_ai_units() -> None:
    assert get_monthly_ai_units("starter") == 3_000
    assert get_monthly_ai_units("pro") == 12_000
    assert get_monthly_ai_units("ultra") == 35_000


def test_agent_limit_starter_only() -> None:
    assert get_agent_limit("starter") == 10
    assert get_agent_limit("pro") is None
    assert get_agent_limit("ultra") is None


def test_topup_packs() -> None:
    packs = list_topup_packs()
    assert len(packs) == 3
    assert get_topup_pack("boost_5k").units == 5_000


def test_monitoring_estimate() -> None:
    per_poll = estimate_monitoring_units_per_poll("gpt-4o-mini")
    monthly = estimate_portfolio_monthly_units(total_daily_polls=2, model="gpt-4o-mini")
    assert monthly == per_poll * TRADING_DAYS_PER_MONTH * 2
