from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self.hits: dict[str, deque[datetime]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = datetime.now(tz=timezone.utc)
        cutoff = now - timedelta(seconds=self.window_seconds)
        bucket = self.hits[key]

        while bucket and bucket[0] < cutoff:
            bucket.popleft()

        if len(bucket) >= self.limit:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")

        bucket.append(now)


from backend.app.core.config import get_settings

rate_limiter = InMemoryRateLimiter(limit=120, window_seconds=60)


async def apply_rate_limit(request: Request) -> None:
    settings = get_settings()
    if settings.debug:
        return
    rate_limiter.check(request.client.host if request.client else "unknown")


