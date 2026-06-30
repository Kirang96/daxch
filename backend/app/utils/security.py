import base64
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

from cryptography.fernet import Fernet
from jose import jwt

from backend.app.core.config import get_settings


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    settings = get_settings()
    expiry_minutes = expires_minutes or settings.access_token_expire_minutes
    expire_at = datetime.now(tz=timezone.utc) + timedelta(minutes=expiry_minutes)
    payload: dict[str, Any] = {"sub": subject, "exp": expire_at}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])


def _build_fernet() -> Fernet:
    settings = get_settings()
    key = settings.fernet_key
    if not key:
        if settings.is_production:
            raise ValueError("FERNET_KEY must be configured in production.")
        key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode("utf-8")).digest()).decode("utf-8")
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid FERNET_KEY format.") from exc


def encrypt_value(value: str) -> str:
    return _build_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value: str) -> str:
    return _build_fernet().decrypt(value.encode("utf-8")).decode("utf-8")

