def compute_volume_metrics(volumes: list[float], period: int = 20) -> dict[str, float | None]:
    if not volumes:
        return {"current": None, "avg_20d": None, "ratio": None}

    current = volumes[-1]
    if len(volumes) < period:
        avg = sum(volumes) / len(volumes)
    else:
        avg = sum(volumes[-period:]) / period

    ratio = round(current / avg, 2) if avg > 0 else None
    return {
        "current": round(current, 0),
        "avg_20d": round(avg, 0),
        "ratio": ratio,
    }
