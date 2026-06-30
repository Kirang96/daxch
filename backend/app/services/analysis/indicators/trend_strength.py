from backend.app.services.analysis.indicators.ema_sma import compute_ema, compute_ema_series


def compute_trend_strength(closes: list[float], ema_period: int = 20) -> dict[str, str | float | None]:
    if len(closes) < ema_period + 5:
        return {"direction": "unknown", "strength": None, "ema_slope_pct": None}

    ema_series = compute_ema_series(closes, ema_period)
    recent_emas = [e for e in ema_series[-10:] if e is not None]
    if len(recent_emas) < 2:
        return {"direction": "unknown", "strength": None, "ema_slope_pct": None}

    slope_pct = ((recent_emas[-1] - recent_emas[0]) / recent_emas[0]) * 100 if recent_emas[0] else 0
    current_price = closes[-1]
    ema_val = compute_ema(closes, ema_period)

    if ema_val is None:
        return {"direction": "unknown", "strength": None, "ema_slope_pct": None}

    if current_price > ema_val and slope_pct > 0.5:
        direction = "bullish"
    elif current_price < ema_val and slope_pct < -0.5:
        direction = "bearish"
    else:
        direction = "sideways"

    strength = min(100.0, abs(slope_pct) * 20)

    return {
        "direction": direction,
        "strength": round(strength, 1),
        "ema_slope_pct": round(slope_pct, 2),
    }
