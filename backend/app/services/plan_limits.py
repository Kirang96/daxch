from __future__ import annotations

PLAN_CONFIG: dict[str, dict] = {
    "starter": {"price": 499, "agent_limit": 10, "monthly_ai_units": 3_000, "name": "Starter"},
    "pro": {"price": 999, "agent_limit": None, "monthly_ai_units": 12_000, "name": "Pro"},
    "ultra": {"price": 2499, "agent_limit": None, "monthly_ai_units": 35_000, "name": "Ultra"},
}


def normalize_plan(plan: str) -> str:
    return plan.lower().strip()


def get_plan_config(plan: str) -> dict:
    return PLAN_CONFIG.get(normalize_plan(plan), PLAN_CONFIG["starter"])


def get_agent_limit(plan: str) -> int | None:
    return get_plan_config(plan).get("agent_limit")


def get_monthly_ai_units(plan: str) -> int:
    return int(get_plan_config(plan).get("monthly_ai_units", 3_000))


def get_max_polling_frequency(plan: str) -> int:
    if normalize_plan(plan) == "starter":
        return 2
    return 12


def is_premium_plan(plan: str) -> bool:
    return normalize_plan(plan) in {"pro", "ultra"}


def is_paid_tier(plan: str) -> bool:
    return normalize_plan(plan) in PLAN_CONFIG
