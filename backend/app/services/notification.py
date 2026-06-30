import json
import logging
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, messaging

from backend.app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class NotificationDeliveryError(RuntimeError):
    pass


@lru_cache
def _firebase_app() -> firebase_admin.App | None:
    if not settings.fcm_credentials_json:
        if settings.is_production:
            raise NotificationDeliveryError("FCM_CREDENTIALS_JSON is required in production.")
        return None

    try:
        creds = json.loads(settings.fcm_credentials_json)
    except json.JSONDecodeError as exc:
        raise NotificationDeliveryError("FCM_CREDENTIALS_JSON is not valid JSON.") from exc
    try:
        return firebase_admin.get_app("daxch-fcm")
    except ValueError:
        pass

    try:
        return firebase_admin.initialize_app(credentials.Certificate(creds), name="daxch-fcm")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to initialize Firebase app")
        raise NotificationDeliveryError("Invalid FCM credentials") from exc


class NotificationService:
    async def send_push(
        self,
        user_id: str,
        title: str,
        body: str,
        payload: dict | None = None,
        device_tokens: list[str] | None = None,
    ) -> None:
        app = _firebase_app()
        if app is None:
            logger.info("notification_skipped user=%s reason=missing_fcm_credentials", user_id)
            return

        tokens = device_tokens or []
        if not tokens:
            logger.warning("notification_skipped user=%s reason=no_device_tokens", user_id)
            return

        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (payload or {}).items()},
        )

        try:
            response = messaging.send_each_for_multicast(message, app=app)
        except Exception as exc:  # noqa: BLE001
            logger.exception("FCM push delivery failed")
            raise NotificationDeliveryError("Failed to deliver push notification") from exc

        if response.failure_count > 0:
            logger.warning(
                "notification_partial_failure user=%s success=%s failed=%s",
                user_id,
                response.success_count,
                response.failure_count,
            )

