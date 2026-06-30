from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.schemas.auth import GoogleCallbackRequest, MagicLinkRequest, MagicLinkVerifyRequest, TokenResponse
from backend.app.services.auth_service import AuthService
from backend.app.services.email_service import EmailDeliveryError, EmailService

router = APIRouter(prefix="/auth", tags=["auth"])
auth_service = AuthService()
email_service = EmailService()
settings = get_settings()


@router.post("/magic-link/request")
async def request_magic_link(payload: MagicLinkRequest) -> dict:
    token = auth_service.create_magic_link_token(payload.email, payload.name)
    verify_url = f"{settings.frontend_base_url.rstrip('/')}/auth/verify?token={token}"

    try:
        await email_service.send_magic_link(str(payload.email), verify_url)
    except EmailDeliveryError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    response: dict[str, str] = {"message": "Magic link sent to email."}
    if not settings.is_production:
        # Helpful for local development and testing.
        response["debug_token"] = token
    return response


@router.post("/magic-link/verify", response_model=TokenResponse)
def verify_magic_link(payload: MagicLinkVerifyRequest, db: Session = Depends(get_db)) -> TokenResponse:
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
    else:
        mock_url = f"{settings.frontend_base_url.rstrip('/')}/auth/mock-google"
        return {"url": mock_url, "mock": True}


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback(payload: GoogleCallbackRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        access_token = await auth_service.authenticate_google(db, payload.code)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TokenResponse(access_token=access_token)

