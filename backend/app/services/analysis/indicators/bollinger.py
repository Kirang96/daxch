from backend.app.services.analysis.indicators.ema_sma import compute_sma


def compute_bollinger(
    closes: list[float],
    period: int = 20,
    num_std: float = 2.0,
) -> dict[str, float | None]:
    if len(closes) < period:
        return {"upper": None, "middle": None, "lower": None, "bandwidth": None}

    window = closes[-period:]
    middle = sum(window) / period
    variance = sum((x - middle) ** 2 for x in window) / period
    std = variance**0.5
    upper = middle + num_std * std
    lower = middle - num_std * std
    bandwidth = ((upper - lower) / middle * 100) if middle else None

    return {
        "upper": round(upper, 4),
        "middle": round(middle, 4),
        "lower": round(lower, 4),
        "bandwidth": round(bandwidth, 2) if bandwidth is not None else None,
    }
