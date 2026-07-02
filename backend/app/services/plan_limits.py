from __future__ import annotations

PLAN_CONFIG: dict[str, dict] = {
    "starter": {"price": 499, "agent_limit": 10, "monthly_ai_units": 3_000, "name": "Starter"},
    "pro": {"price": 999, "agent_limit": None, "monthly_ai_units": 12_000, "name": "Pro"},
    "ultra": {"price": 2499, "agent_limit": None, "monthly_ai_units": 35_000, "name": "Ultra"},
}


PLAN_ORDER = ("starter", "pro", "ultra")


def normalize_plan(plan: str) -> str:
    return plan.lower().strip()


def plan_tier_rank(plan: str) -> int:
    normalized = normalize_plan(plan)
    try:
        return PLAN_ORDER.index(normalized)
    except ValueError:
        return 0


def assert_not_downgrade(current_plan: str, target_plan: str) -> None:
    if plan_tier_rank(target_plan) < plan_tier_rank(current_plan):
        raise ValueError(f"Cannot subscribe to {target_plan} while on active {current_plan} plan.")


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
