from datetime import datetime, timezone

IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
PRE_OPEN_START = 9 * 60
REGULAR_START = 9 * 60 + 15
REGULAR_END = 15 * 60 + 30


def _ist_clock(now: datetime) -> tuple[int, int]:
    ist = datetime.fromtimestamp(now.timestamp() + IST_OFFSET_MS, tz=timezone.utc)
    return ist.weekday(), ist.hour * 60 + ist.minute


def is_nse_regular_session_open(now: datetime | None = None) -> bool:
    """True during NSE/BSE regular cash session (Mon–Fri 9:15–15:30 IST)."""
    current = now or datetime.now(tz=timezone.utc)
    weekday, minutes = _ist_clock(current)
    if weekday >= 5:
        return False
    return REGULAR_START <= minutes < REGULAR_END


def should_use_amo(now: datetime | None = None) -> bool:
    """Use AMO when regular session is closed on a weekday (or weekend)."""
    return not is_nse_regular_session_open(now)
