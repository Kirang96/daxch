from datetime import datetime, timedelta, timezone

import hashlib

import bcrypt
from jose import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.models.entities import User
from backend.app.utils.security import create_access_token

_BCRYPT_ROUNDS = 12
_MIN_PASSWORD_LEN = 8
_MAX_PASSWORD_LEN = 128


def _password_prehash(password: str) -> bytes:
    return hashlib.sha256(password.encode("utf-8")).digest()


class AuthService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def hash_password(self, password: str) -> str:
        try:
            hashed = bcrypt.hashpw(_password_prehash(password), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
            return hashed.decode("ascii")
        except ValueError as exc:
            raise ValueError("Could not set password. Choose a different password and try again.") from exc

    def verify_password(self, password: str, password_hash: str | None) -> bool:
        if not password_hash:
            return False
        try:
            return bcrypt.checkpw(_password_prehash(password), password_hash.encode("ascii"))
        except ValueError:
            return False

    def _validate_password(self, password: str) -> None:
        if len(password) < _MIN_PASSWORD_LEN:
            raise ValueError(f"Password must be at least {_MIN_PASSWORD_LEN} characters.")
        if len(password) > _MAX_PASSWORD_LEN:
            raise ValueError(f"Password must be at most {_MAX_PASSWORD_LEN} characters.")

    def _sync_admin_flag(self, db: Session, user: User) -> None:
        allowed = self.settings.admin_emails_list
        if not allowed:
            return
        should_admin = user.email.lower() in allowed
        if user.is_admin != should_admin:
            user.is_admin = should_admin
            db.commit()
            db.refresh(user)

    def _issue_token(self, db: Session, user: User) -> str:
        self._sync_admin_flag(db, user)
        return create_access_token(str(user.id))

    def register_or_login_user(self, db: Session, email: str, name: str | None = None) -> str:
        email = email.lower().strip()
        stmt = select(User).where(User.email == email)
        user = db.execute(stmt).scalar_one_or_none()
        if not user:
            user = User(email=email, name=name)
            db.add(user)
            db.flush()
            db.commit()
            db.refresh(user)
        return self._issue_token(db, user)

    def register_with_password(self, db: Session, email: str, password: str, name: str | None = None) -> str:
        self._validate_password(password)
        email = email.lower().strip()
        stmt = select(User).where(User.email == email)
        user = db.execute(stmt).scalar_one_or_none()
        if user and user.password_hash:
            raise ValueError("An account with this email already exists. Sign in instead.")
        if not user:
            user = User(email=email, name=name)
            db.add(user)
            db.flush()
        user.password_hash = self.hash_password(password)
        if name:
            user.name = name
        db.commit()
        db.refresh(user)
        return self._issue_token(db, user)

    def login_with_password(self, db: Session, email: str, password: str) -> str:
        email = email.lower().strip()
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if not user:
            raise ValueError("Invalid email or password.")
        if not user.password_hash:
            raise ValueError("No password set for this account. Use Forgot password to create one.")
        if not self.verify_password(password, user.password_hash):
            raise ValueError("Invalid email or password.")
        return self._issue_token(db, user)

    def refresh_access_token(self, db: Session, user: User) -> str:
        return self._issue_token(db, user)

    def set_password(self, db: Session, user: User, password: str) -> None:
        self._validate_password(password)
        user.password_hash = self.hash_password(password)
        db.commit()

    def create_password_reset_token(self, email: str) -> str:
        expire_at = datetime.now(tz=timezone.utc) + timedelta(minutes=30)
        payload = {"sub": email.lower().strip(), "purpose": "password_reset", "exp": expire_at}
        return jwt.encode(payload, self.settings.secret_key, algorithm="HS256")

    def verify_password_reset_token(self, token: str) -> str:
        payload = jwt.decode(token, self.settings.secret_key, algorithms=["HS256"])
        if payload.get("purpose") != "password_reset":
            raise ValueError("Invalid reset token")
        return str(payload["sub"]).lower().strip()

    def reset_password_with_token(self, db: Session, token: str, password: str) -> str:
        email = self.verify_password_reset_token(token)
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        if not user:
            raise ValueError("Account not found.")
        self.set_password(db, user, password)
        return self._issue_token(db, user)

    def create_magic_link_token(self, email: str, name: str | None = None) -> str:
        expire_at = datetime.now(tz=timezone.utc) + timedelta(minutes=self.settings.magic_link_expire_minutes)
        payload = {"sub": email.lower().strip(), "name": name, "purpose": "magic_link", "exp": expire_at}
        return jwt.encode(payload, self.settings.secret_key, algorithm="HS256")

    def verify_magic_link_token(self, db: Session, token: str) -> str:
        payload = jwt.decode(token, self.settings.secret_key, algorithms=["HS256"])
        if payload.get("purpose") != "magic_link":
            raise ValueError("Invalid magic link token")

        email = str(payload["sub"]).lower().strip()
        name = payload.get("name")
        return self.register_or_login_user(db, email, name)

    async def authenticate_google(self, db: Session, code: str) -> str:
        is_mock = code.startswith("mock_code_") or not (
            self.settings.google_client_id
            and self.settings.google_client_secret
            and self.settings.google_redirect_uri
        )

        if is_mock:
            if code.startswith("mock_code_"):
                email = code.replace("mock_code_", "")
            else:
                email = code

            if not email or "@" not in email:
                email = "demo_google_user@daxch.com"

            name = email.split("@")[0].replace(".", " ").title()
            return self.register_or_login_user(db, email, name)

        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            token_url = "https://oauth2.googleapis.com/token"
            payload = {
                "code": code,
                "client_id": self.settings.google_client_id,
                "client_secret": self.settings.google_client_secret,
                "redirect_uri": self.settings.google_redirect_uri,
                "grant_type": "authorization_code",
            }
            res = await client.post(token_url, data=payload)
            res.raise_for_status()
            tokens = res.json()
            access_token = tokens["access_token"]

            userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
            res = await client.get(userinfo_url, headers={"Authorization": f"Bearer {access_token}"})
            res.raise_for_status()
            userinfo = res.json()

        email = userinfo["email"]
        name = userinfo.get("name")
        return self.register_or_login_user(db, email, name)
