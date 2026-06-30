def compute_sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return round(sum(values[-period:]) / period, 4)


def compute_ema(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    for price in values[period:]:
        ema = (price - ema) * multiplier + ema
    return round(ema, 4)


def compute_ema_series(values: list[float], period: int) -> list[float | None]:
    if len(values) < period:
        return [None] * len(values)
    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    series: list[float | None] = [None] * (period - 1) + [ema]
    for price in values[period:]:
        ema = (price - ema) * multiplier + ema
        series.append(ema)
    return series
