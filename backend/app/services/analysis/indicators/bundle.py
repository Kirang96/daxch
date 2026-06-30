from typing import Any

from backend.app.services.broker.base import CandleBar
from backend.app.services.analysis.indicators.atr import compute_atr
from backend.app.services.analysis.indicators.bollinger import compute_bollinger
from backend.app.services.analysis.indicators.ema_sma import compute_ema, compute_sma
from backend.app.services.analysis.indicators.macd import compute_macd
from backend.app.services.analysis.indicators.rsi import compute_rsi
from backend.app.services.analysis.indicators.support_resistance import compute_support_resistance
from backend.app.services.analysis.indicators.trend_strength import compute_trend_strength
from backend.app.services.analysis.indicators.volume import compute_volume_metrics


def compute_technical_bundle(
    candles: list[CandleBar],
    current_price: float | None = None,
) -> dict[str, Any]:
    if not candles:
        return {"error": "insufficient_data", "bars": 0}

    closes = [c.close for c in candles]
    highs = [c.high for c in candles]
    lows = [c.low for c in candles]
    volumes = [c.volume for c in candles]
    price = current_price if current_price is not None else closes[-1]

    recent_ohlc = [
        {
            "date": c.timestamp,
            "open": c.open,
            "high": c.high,
            "low": c.low,
            "close": c.close,
            "volume": c.volume,
        }
        for c in candles[-10:]
    ]

    return {
        "bars": len(candles),
        "current_price": price,
        "recent_ohlc": recent_ohlc,
        "rsi_14": compute_rsi(closes, 14),
        "macd": compute_macd(closes),
        "ema_20": compute_ema(closes, 20),
        "ema_50": compute_ema(closes, 50),
        "sma_20": compute_sma(closes, 20),
        "sma_50": compute_sma(closes, 50),
        "bollinger": compute_bollinger(closes),
        "atr_14": compute_atr(highs, lows, closes, 14),
        "support_resistance": compute_support_resistance(highs, lows),
        "trend": compute_trend_strength(closes),
        "volume": compute_volume_metrics(volumes),
    }
