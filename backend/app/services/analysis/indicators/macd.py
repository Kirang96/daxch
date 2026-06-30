from backend.app.services.analysis.indicators.ema_sma import compute_ema_series


def compute_macd(
    closes: list[float],
    fast: int = 12,
    slow: int = 26,
    signal_period: int = 9,
) -> dict[str, float | None]:
    if len(closes) < slow + signal_period:
        return {"macd": None, "signal": None, "histogram": None}

    fast_ema = compute_ema_series(closes, fast)
    slow_ema = compute_ema_series(closes, slow)

    macd_line: list[float] = []
    for f, s in zip(fast_ema, slow_ema):
        if f is not None and s is not None:
            macd_line.append(f - s)

    if len(macd_line) < signal_period:
        return {"macd": None, "signal": None, "histogram": None}

    signal_series = compute_ema_series(macd_line, signal_period)
    macd_val = macd_line[-1]
    signal_val = signal_series[-1]
    if signal_val is None:
        return {"macd": None, "signal": None, "histogram": None}

    return {
        "macd": round(macd_val, 4),
        "signal": round(signal_val, 4),
        "histogram": round(macd_val - signal_val, 4),
    }
