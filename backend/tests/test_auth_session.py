from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from backend.app.core.config import get_settings
from backend.app.utils.security import create_access_token, decode_token


def test_create_and_decode_token() -> None:
    token = create_access_token("user-123", expires_minutes=60)
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert "exp" in payload


def test_expired_token_rejected() -> None:
    settings = get_settings()
    expire_at = datetime.now(tz=timezone.utc) - timedelta(minutes=1)
    payload = {"sub": "x", "exp": expire_at}
    token = jwt.encode(payload, settings.secret_key, algorithm="HS256")
    with pytest.raises(Exception):  # noqa: B017
        decode_token(token)
