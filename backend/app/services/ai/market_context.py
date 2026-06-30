import statistics
from typing import Any


def compute_volatility_metrics(prices: list[float]) -> dict[str, Any]:
    if len(prices) < 5:
        return {
            "volatility_level": "unknown",
            "daily_volatility_pct": None,
            "recent_range_pct": None,
        }

    recent = prices[-20:] if len(prices) >= 20 else prices
    returns: list[float] = []
    for idx in range(1, len(recent)):
        prev = recent[idx - 1]
        if prev > 0:
            returns.append((recent[idx] - prev) / prev)

    daily_vol = statistics.pstdev(returns) * 100 if len(returns) >= 2 else 0.0
    high, low = max(recent), min(recent)
    range_pct = ((high - low) / low * 100) if low > 0 else 0.0

    if daily_vol >= 2.5 or range_pct >= 15:
        level = "high"
    elif daily_vol >= 1.2 or range_pct >= 8:
        level = "moderate"
    else:
        level = "low"

    return {
        "volatility_level": level,
        "daily_volatility_pct": round(daily_vol, 2),
        "recent_range_pct": round(range_pct, 2),
    }


def build_market_context(
    *,
    change_percent: float | None,
    prices: list[float],
) -> dict[str, Any]:
    vol = compute_volatility_metrics(prices)
    return {
        **vol,
        "day_change_percent": change_percent,
    }
