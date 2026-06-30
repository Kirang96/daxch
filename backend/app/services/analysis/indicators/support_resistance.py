def compute_support_resistance(
    highs: list[float],
    lows: list[float],
    lookback: int = 60,
) -> dict[str, float | None]:
    if not highs or not lows:
        return {"support": None, "resistance": None}

    window_highs = highs[-lookback:]
    window_lows = lows[-lookback:]

    supports: list[float] = []
    resistances: list[float] = []

    for i in range(2, len(window_lows) - 2):
        if window_lows[i] <= window_lows[i - 1] and window_lows[i] <= window_lows[i - 2]:
            if window_lows[i] <= window_lows[i + 1] and window_lows[i] <= window_lows[i + 2]:
                supports.append(window_lows[i])
        if window_highs[i] >= window_highs[i - 1] and window_highs[i] >= window_highs[i - 2]:
            if window_highs[i] >= window_highs[i + 1] and window_highs[i] >= window_highs[i + 2]:
                resistances.append(window_highs[i])

    support = round(min(supports), 2) if supports else round(min(window_lows), 2)
    resistance = round(max(resistances), 2) if resistances else round(max(window_highs), 2)

    return {"support": support, "resistance": resistance}
