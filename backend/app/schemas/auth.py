from pydantic import BaseModel, EmailStr, Field


class MagicLinkRequest(BaseModel):
    email: EmailStr
    name: str | None = None


class MagicLinkVerifyRequest(BaseModel):
    token: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class PasswordForgotRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class GoogleCallbackRequest(BaseModel):
    code: str


class AuthConfigResponse(BaseModel):
    magic_link_enabled: bool
    password_login_enabled: bool = True
