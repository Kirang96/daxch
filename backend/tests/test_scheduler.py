from datetime import datetime, timezone

from backend.app.agents.scheduler import _next_poll_time


def test_standard_frequency_generates_future_time() -> None:
    now = datetime(2026, 6, 30, 4, 0, tzinfo=timezone.utc)  # 9:30 IST
    next_time = _next_poll_time(2, now=now)
    assert next_time > now


def test_custom_frequency_generates_future_time() -> None:
    now = datetime(2026, 6, 30, 6, 0, tzinfo=timezone.utc)
    next_time = _next_poll_time(6, now=now)
    assert next_time > now

