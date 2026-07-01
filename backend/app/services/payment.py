import base64
import hashlib
import hmac
from datetime import datetime, timezone
from typing import Any

import httpx

from backend.app.core.config import get_settings
from backend.app.services.ai_units.topup_packs import get_topup_pack


class PaymentConfigurationError(RuntimeError):
    pass


class PaymentService:
    def __init__(self) -> None:
        self.settings = get_settings()

    def _basic_auth(self) -> str:
        if not self.settings.razorpay_key_id or not self.settings.razorpay_key_secret:
            raise PaymentConfigurationError("Razorpay keys are not configured.")
        auth = f"{self.settings.razorpay_key_id}:{self.settings.razorpay_key_secret}"
        return base64.b64encode(auth.encode("utf-8")).decode("utf-8")

    def _plan_id(self, plan: str) -> str:
        plan_key = plan.lower().strip()
        plan_map = {
            "starter": self.settings.razorpay_plan_starter_id,
            "pro": self.settings.razorpay_plan_pro_id,
            "ultra": self.settings.razorpay_plan_ultra_id,
        }
        plan_id = plan_map.get(plan_key, "")
        if not plan_id:
            raise PaymentConfigurationError(f"Razorpay plan id not configured for '{plan_key}'.")
        return plan_id

    async def create_subscription(self, plan: str, user_email: str) -> dict[str, Any]:
        auth_header = self._basic_auth()
        payload = {
            "plan_id": self._plan_id(plan),
            "total_count": 120,
            "quantity": 1,
            "customer_notify": 1,
            "notes": {"email": user_email, "product": "daxch"},
        }
        headers = {"Authorization": f"Basic {auth_header}"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post("https://api.razorpay.com/v1/subscriptions", json=payload, headers=headers)
            if response.status_code == 401:
                raise PaymentConfigurationError(
                    "Razorpay error: Authentication failed. "
                    "Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in AWS Secrets Manager "
                    "(run scripts/restore-staging-secrets.ps1 after updating terraform.tfvars)."
                )
            if response.status_code >= 400:
                detail = response.text
                try:
                    detail = response.json().get("error", {}).get("description", detail)
                except Exception:
                    pass
                raise PaymentConfigurationError(f"Razorpay error: {detail}")
            data = response.json()

        period_end = data.get("current_end")
        return {
            "provider": "razorpay",
            "subscription_id": data["id"],
            "status": data["status"],
            "checkout_url": data.get("short_url"),
            "current_period_end": datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat() if period_end else None,
        }

    async def create_topup_order(self, pack_id: str, user_email: str) -> dict[str, Any]:
        pack = get_topup_pack(pack_id)
        if pack is None:
            raise PaymentConfigurationError(f"Unknown top-up pack '{pack_id}'.")
        auth_header = self._basic_auth()
        payload = {
            "amount": pack.price_inr * 100,
            "currency": "INR",
            "receipt": f"ai_units_{pack_id}_{int(datetime.now(tz=timezone.utc).timestamp())}",
            "notes": {"email": user_email, "product": "daxch_ai_units", "pack_id": pack_id},
        }
        headers = {"Authorization": f"Basic {auth_header}"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post("https://api.razorpay.com/v1/orders", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
        return {
            "order_id": data["id"],
            "amount": data["amount"],
            "currency": data.get("currency", "INR"),
        }

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> None:
        if not self.settings.razorpay_key_secret:
            raise PaymentConfigurationError("Razorpay keys are not configured.")
        body = f"{order_id}|{payment_id}"
        expected = hmac.new(
            self.settings.razorpay_key_secret.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise ValueError("Invalid payment signature")

    async def fetch_subscription(self, subscription_id: str) -> dict[str, Any]:
        auth_header = self._basic_auth()
        headers = {"Authorization": f"Basic {auth_header}"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(f"https://api.razorpay.com/v1/subscriptions/{subscription_id}", headers=headers)
            response.raise_for_status()
            return response.json()

    def verify_webhook_signature(self, raw_body: bytes, signature: str) -> bool:
        if not self.settings.razorpay_webhook_secret:
            raise PaymentConfigurationError("RAZORPAY_WEBHOOK_SECRET is not configured.")
        expected = hmac.new(
            self.settings.razorpay_webhook_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
