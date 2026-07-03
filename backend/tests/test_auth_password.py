import pytest

from backend.app.services.auth_service import AuthService


def test_hash_and_verify_long_password() -> None:
    service = AuthService()
    password = "a" * 100
    service._validate_password(password)
    hashed = service.hash_password(password)
    assert service.verify_password(password, hashed)
    assert not service.verify_password("wrong-password", hashed)


def test_validate_password_too_short() -> None:
    service = AuthService()
    with pytest.raises(ValueError, match="at least 8"):
        service._validate_password("short")


def test_validate_password_too_long() -> None:
    service = AuthService()
    with pytest.raises(ValueError, match="at most 128"):
        service._validate_password("a" * 129)
