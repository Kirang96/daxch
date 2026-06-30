from backend.app.services.analysis.indicators.macd import compute_macd
from backend.app.services.analysis.indicators.rsi import compute_rsi
from backend.app.services.analysis.indicators.ema_sma import compute_sma
from backend.app.services.broker.base import CandleBar
from backend.app.services.analysis.indicators.bundle import compute_technical_bundle


def test_rsi_returns_value_for_sufficient_data():
    closes = [100 + i * 0.5 for i in range(30)]
    rsi = compute_rsi(closes, period=14)
    assert rsi is not None
    assert 0 <= rsi <= 100


def test_rsi_insufficient_data_returns_none():
    assert compute_rsi([100, 101, 102], period=14) is None


def test_macd_returns_keys():
    closes = [100 + i * 0.3 for i in range(40)]
    result = compute_macd(closes)
    assert "macd" in result
    assert "signal" in result
    assert "histogram" in result
    assert result["macd"] is not None


def test_sma_computes_average():
    assert compute_sma([10, 20, 30, 40, 50], period=5) == 30.0


def test_technical_bundle_includes_indicators():
    candles = [
        CandleBar(
            timestamp=f"2024-01-{i+1:02d}",
            open=100 + i,
            high=102 + i,
            low=99 + i,
            close=101 + i,
            volume=1_000_000 + i * 1000,
        )
        for i in range(60)
    ]
    bundle = compute_technical_bundle(candles, current_price=160)
    assert bundle["bars"] == 60
    assert bundle["rsi_14"] is not None
    assert bundle["macd"]["macd"] is not None
    assert bundle["trend"]["direction"] in {"bullish", "bearish", "sideways", "unknown"}
