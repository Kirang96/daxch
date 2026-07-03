from typing import Any

from backend.app.services.ai.analyst import clamp_polling_frequency


def suggest_polling_frequency(
    intention: str,
    technical_data: dict[str, Any],
    user_polling_frequency: int,
    decision_type: str,
    risk_flags: list[str],
    *,
    earnings_within_days: int | None = None,
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

    if earnings_within_days is not None and earnings_within_days <= 14:
        suggested = min(12, suggested + 1)
        factors.append(f"Earnings report expected in {earnings_within_days} day(s)")

    if "EARNINGS_SOON" in risk_flags and "Earnings report expected" not in " ".join(factors):
        suggested = min(12, suggested + 1)
        factors.append("Upcoming earnings event flagged in analysis")

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


def suggest_entry_rationale(
    *,
    suggested_entry: float,
    current_price: float,
    planned_entry_price: float | None,
    signal: str,
    technical_data: dict[str, Any],
) -> str:
    if suggested_entry <= 0:
        return "No entry price suggested — conditions do not support a limit order at this time."

    sr = technical_data.get("support_resistance") or {}
    support = sr.get("support")
    resistance = sr.get("resistance")
    parts: list[str] = []

    if signal == "high_risk":
        parts.append("Elevated risk flags suggest using the current market price rather than chasing.")
    elif signal == "buy_near_support":
        if support and float(support) < current_price:
            parts.append(f"Nearby support near ₹{float(support):.2f} offers a better risk/reward than buying at market.")
        else:
            parts.append("A slight discount below the current price improves entry quality without chasing momentum.")
    elif signal == "wait":
        if resistance and float(resistance) > current_price:
            parts.append(f"Resistance near ₹{float(resistance):.2f} suggests waiting for a clearer setup.")
        else:
            parts.append("Technical conditions favor patience at or near the current price.")

    if planned_entry_price and planned_entry_price > 0:
        diff_pct = ((suggested_entry - planned_entry_price) / planned_entry_price) * 100
        if abs(diff_pct) >= 0.5:
            direction = "below" if diff_pct < 0 else "above"
            parts.append(
                f"This is {abs(diff_pct):.1f}% {direction} your planned limit of ₹{planned_entry_price:.2f}."
            )

    if current_price > 0 and suggested_entry != current_price:
        parts.append(f"Current market price is ₹{current_price:.2f}; suggested limit is ₹{suggested_entry:.2f}.")

    return " ".join(parts) if parts else f"Suggested limit ₹{suggested_entry:.2f} based on current technical levels."
