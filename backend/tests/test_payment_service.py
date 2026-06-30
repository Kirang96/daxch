import hashlib
import hmac

from backend.app.services.payment import PaymentService


def test_verify_webhook_signature() -> None:
    service = PaymentService()
    if not service.settings.razorpay_webhook_secret:
        service.settings.razorpay_webhook_secret = "test-secret"

    payload = b'{"event":"subscription.activated"}'
    signature = hmac.new(
        service.settings.razorpay_webhook_secret.encode("utf-8"),
        payload,
        hashlib.sha256,
    ).hexdigest()
    assert service.verify_webhook_signature(payload, signature)

