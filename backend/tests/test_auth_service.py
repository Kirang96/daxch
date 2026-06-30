from jose import jwt

from backend.app.services.auth_service import AuthService


def test_magic_link_token_contains_purpose() -> None:
    service = AuthService()
    token = service.create_magic_link_token("user@example.com", "User")
    payload = jwt.decode(token, service.settings.secret_key, algorithms=["HS256"])
    assert payload["purpose"] == "magic_link"
    assert payload["sub"] == "user@example.com"

