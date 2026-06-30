from typing import Any

from backend.app.services.ai.analyst import clamp_polling_frequency


def suggest_polling_frequency(
    intention: str,
    technical_data: dict[str, Any],
    user_polling_frequency: int,
    decision_type: str,
    risk_flags: list[str],
) -> tuple[int, str, list[str]]:
    vol_level = "moderate"
    trend = technical_data.get("trend") or {}
    bollinger = technical_data.get("bollinger") or {}
    if bollinger.get("bandwidth") and float(bollinger["bandwidth"]) >= 12:
        vol_level = "high"
    elif bollinger.get("bandwidth") and float(bollinger["bandwidth"]) <= 5:
        vol_level = "low"

    factors: list[str] = []
    if vol_level == "high":
        suggested = 6
        factors.append("Elevated price volatility")
    elif vol_level == "moderate":
        suggested = 4
        factors.append("Moderate recent volatility")
    else:
        suggested = 2
        factors.append("Relatively stable price action")

    if decision_type in ("buy_more", "enter"):
        suggested = min(12, suggested + 1)
        factors.append("Active entry setup warrants closer monitoring")
    elif decision_type == "sell":
        suggested = min(12, suggested + 2)
        factors.append("Exit or reduce scenarios benefit from timely checks")

    if intention in {"swing", "short_term", "swing_trade"}:
        suggested = min(12, suggested + 2)
        factors.append("Shorter holding horizon benefits from more frequent checks")
    elif intention in {"long_term", "retirement", "dividend"}:
        suggested = max(2, suggested - 1) if suggested > 2 else 2

    if "HIGH_VOLATILITY" in risk_flags or "VOLATILITY_HIGH" in risk_flags:
        suggested = min(12, suggested + 2)
        factors.append("High volatility flagged in analysis")

    if user_polling_frequency > suggested:
        factors.append(f"You requested {user_polling_frequency}/day — assessed against current conditions")

    suggested = clamp_polling_frequency(suggested)
    rationale = (
        f"We recommend {suggested} checks per trading day based on volatility ({vol_level}) "
        f"and your {intention.replace('_', ' ')} goal."
    )
    return suggested, rationale, factors[:6]


def suggest_entry(
    current_price: float,
    decision_type: str,
    technical_data: dict[str, Any],
    risk_flags: list[str],
) -> tuple[float, str]:
    if current_price <= 0:
        return 0.0, "wait"

    high_risk_flags = {
        "HIGH_VOLATILITY",
        "VOLATILITY_HIGH",
        "REGULATORY_RISK",
        "EVENT_RISK",
        "UNCERTAIN_INFORMATION",
        "POOR_RISK_REWARD",
    }
    if high_risk_flags.intersection(set(risk_flags)):
        return round(current_price, 2), "high_risk"

    sr = technical_data.get("support_resistance") or {}
    support = sr.get("support")
    resistance = sr.get("resistance")

    if decision_type in ("buy_more", "enter"):
        if support and float(support) < current_price:
            return round(float(support), 2), "buy_near_support"
        return round(current_price * 0.985, 2), "buy_near_support"

    if decision_type in ("sell", "dont_enter"):
        if resistance and float(resistance) > current_price:
            return round(float(resistance), 2), "wait"
        return round(current_price, 2), "wait"

    return round(current_price, 2), "wait"
