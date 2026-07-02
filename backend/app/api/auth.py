from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.schemas.auth import (
    AuthConfigResponse,
    GoogleCallbackRequest,
    LoginRequest,
    MagicLinkRequest,
    MagicLinkVerifyRequest,
    PasswordForgotRequest,
    PasswordResetRequest,
    RegisterRequest,
    TokenResponse,
)
from backend.app.services.auth_service import AuthService
from backend.app.services.email_service import EmailDeliveryError, EmailService

router = APIRouter(prefix="/auth", tags=["auth"])
auth_service = AuthService()
email_service = EmailService()
settings = get_settings()


@router.get("/config", response_model=AuthConfigResponse)
def auth_config() -> AuthConfigResponse:
    return AuthConfigResponse(magic_link_enabled=not settings.is_production)


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        access_token = auth_service.register_with_password(db, payload.email, payload.password, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        access_token = auth_service.login_with_password(db, payload.email, payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return TokenResponse(access_token=access_token)


@router.post("/password/forgot")
async def forgot_password(payload: PasswordForgotRequest) -> dict:
    token = auth_service.create_password_reset_token(str(payload.email))
    reset_url = f"{settings.frontend_base_url.rstrip('/')}/auth/reset-password?token={token}"
    try:
        await email_service.send_password_reset(str(payload.email), reset_url)
    except EmailDeliveryError as exc:
        if settings.is_production:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    response: dict[str, str] = {"message": "If an account exists, a reset link was sent."}
    if not settings.is_production:
        response["debug_token"] = token
    return response


@router.post("/password/reset", response_model=TokenResponse)
def reset_password(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        access_token = auth_service.reset_password_with_token(db, payload.token, payload.password)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token") from exc
    return TokenResponse(access_token=access_token)


@router.post("/magic-link/request")
async def request_magic_link(payload: MagicLinkRequest) -> dict:
    if settings.is_production:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Magic link sign-in is disabled in production. Use email and password.",
        )
    token = auth_service.create_magic_link_token(payload.email, payload.name)
    verify_url = f"{settings.frontend_base_url.rstrip('/')}/auth/verify?token={token}"

    try:
        await email_service.send_magic_link(str(payload.email), verify_url)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    response: dict[str, str] = {"message": "Magic link sent to email."}
    if not settings.is_production:
        response["debug_token"] = token
    return response


@router.post("/magic-link/verify", response_model=TokenResponse)
def verify_magic_link(payload: MagicLinkVerifyRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if settings.is_production:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Magic link sign-in is disabled in production.")
    try:
        access_token = auth_service.verify_magic_link_token(db, payload.token)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token") from exc
    return TokenResponse(access_token=access_token)


@router.get("/google/login")
def google_login() -> dict:
    if settings.google_client_id and settings.google_redirect_uri:
        url = (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?response_type=code&client_id={settings.google_client_id}"
            f"&redirect_uri={settings.google_redirect_uri}"
            "&scope=openid%20email%20profile"
        )
        return {"url": url, "mock": False}
    mock_url = f"{settings.frontend_base_url.rstrip('/')}/auth/mock-google"
    return {"url": mock_url, "mock": True}


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback(payload: GoogleCallbackRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        access_token = await auth_service.authenticate_google(db, payload.code)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TokenResponse(access_token=access_token)
