from datetime import datetime, timedelta, timezone
import hashlib

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import InvoiceRecord, NotificationType, PlanTier, Subscription, User, WebhookEvent
from backend.app.schemas.subscription import InvoiceResponse, SubscriptionCreateRequest, SubscriptionResponse
from backend.app.services.subscription_access import get_latest_subscription
from backend.app.services.notification_events import create_notification_event
from backend.app.services.payment import PaymentConfigurationError, PaymentService
from backend.app.services.plan_limits import PLAN_CONFIG

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])
payment_service = PaymentService()

PLAN_MAP = PLAN_CONFIG


def _to_response(sub: Subscription) -> SubscriptionResponse:
    return SubscriptionResponse(
        id=sub.id,
        plan=sub.plan.value,
        status=sub.status,
        current_period_end=sub.current_period_end,
        trial_ends_at=None,
        days_left=None,
        is_trial=False,
        provider_subscription_id=sub.razorpay_sub_id,
    )


@router.get("/config")
def subscription_config() -> dict:
    settings = get_settings()
    return {"dev_activate_available": settings.environment == "development"}


@router.get("/plans")
def list_plans() -> dict:
    return PLAN_MAP


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    payload: SubscriptionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionResponse:
    plan = payload.plan.lower().strip()
    if plan not in PLAN_MAP:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported plan")

    try:
        provider_data = await payment_service.create_subscription(plan=plan, user_email=current_user.email)
    except PaymentConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    sub = Subscription(
        user_id=current_user.id,
        plan=PlanTier(plan),
        razorpay_sub_id=provider_data.get("subscription_id"),
        status=provider_data.get("status", "created"),
        current_period_end=(
            datetime.fromisoformat(provider_data["current_period_end"]) if provider_data.get("current_period_end") else None
        ),
    )
    db.add(sub)
    create_notification_event(
        db,
        current_user.id,
        NotificationType.system,
        "Subscription request created",
        f"Your {plan} subscription request has been created.",
        {"plan": plan},
    )
    db.commit()
    db.refresh(sub)
    return SubscriptionResponse(
        id=sub.id,
        plan=sub.plan.value,
        status=sub.status,
        current_period_end=sub.current_period_end,
        trial_ends_at=sub.trial_ends_at,
        days_left=None,
        is_trial=False,
        checkout_url=provider_data.get("checkout_url"),
        provider_subscription_id=sub.razorpay_sub_id,
        key_id=get_settings().razorpay_key_id or None,
    )


@router.get("/current", response_model=SubscriptionResponse | None)
def current_subscription(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionResponse | None:
    sub = get_latest_subscription(db, current_user.id)
    if not sub:
        return None
    return _to_response(sub)


@router.post("/dev-activate", response_model=SubscriptionResponse)
def dev_activate_subscription(
    payload: SubscriptionCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubscriptionResponse:
    settings = get_settings()
    if settings.environment != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    plan = payload.plan.lower().strip()
    if plan not in PLAN_MAP:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported plan")

    now = datetime.now(tz=timezone.utc)
    period_end = now + timedelta(days=365)
    sub = get_latest_subscription(db, current_user.id)
    if sub:
        sub.plan = PlanTier(plan)
        sub.status = "active"
        sub.current_period_end = period_end
        sub.trial_ends_at = None
        if not sub.razorpay_sub_id:
            sub.razorpay_sub_id = f"dev_{current_user.id}"
    else:
        sub = Subscription(
            user_id=current_user.id,
            plan=PlanTier(plan),
            status="active",
            current_period_end=period_end,
            razorpay_sub_id=f"dev_{current_user.id}",
        )
        db.add(sub)

    current_user.plan_tier = PlanTier(plan)
    create_notification_event(
        db,
        current_user.id,
        NotificationType.system,
        "Subscription activated (dev)",
        f"Your {plan} subscription is active for local development.",
        {"plan": plan, "source": "dev_activate"},
    )
    db.commit()
    db.refresh(sub)
    return _to_response(sub)


@router.get("/invoices", response_model=list[InvoiceResponse])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InvoiceResponse]:
    stmt = select(InvoiceRecord).where(InvoiceRecord.user_id == current_user.id).order_by(InvoiceRecord.invoice_date.desc())
    invoices = db.execute(stmt).scalars().all()
    return [InvoiceResponse.model_validate(invoice) for invoice in invoices]


@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(default=""),
    db: Session = Depends(get_db),
) -> dict:
    payload_bytes = await request.body()
    event_hash = hashlib.sha256(payload_bytes).hexdigest()

    existing_event = db.execute(select(WebhookEvent).where(WebhookEvent.event_hash == event_hash)).scalar_one_or_none()
    if existing_event:
        return {"processed": True, "duplicate": True}

    try:
        if not payment_service.verify_webhook_signature(payload_bytes, x_razorpay_signature):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")
    except PaymentConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    payload = await request.json()
    event = payload.get("event", "")

    if event == "payment.captured":
        payment_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        order_id = payment_entity.get("order_id")
        payment_id = payment_entity.get("id")
        notes = payment_entity.get("notes") or {}
        if notes.get("product") == "daxch_ai_units" and order_id and payment_id:
            from backend.app.models.entities import AiUnitTopupPurchase
            from backend.app.services.ai_units.service import AiUnitsService

            db.add(WebhookEvent(source="razorpay", event_hash=event_hash))
            purchase = db.execute(
                select(AiUnitTopupPurchase).where(AiUnitTopupPurchase.razorpay_order_id == order_id)
            ).scalar_one_or_none()
            if purchase and purchase.status != "paid":
                purchase.razorpay_payment_id = payment_id
                AiUnitsService.credit_bonus(db, purchase.user_id, purchase.units_granted, purchase.id)
            db.commit()
            return {"processed": True, "event": event, "order_id": order_id}

    entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    subscription_id = entity.get("id")
    if not subscription_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing subscription id in webhook payload")

    sub = db.execute(select(Subscription).where(Subscription.razorpay_sub_id == subscription_id)).scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscription not found")

    db.add(WebhookEvent(source="razorpay", event_hash=event_hash))

    if event in {"subscription.activated", "subscription.charged"}:
        sub.status = "active"
        current_end = entity.get("current_end")
        if current_end:
            sub.current_period_end = datetime.fromtimestamp(current_end, tz=timezone.utc)
        user = db.get(User, sub.user_id)
        if user:
            user.plan_tier = sub.plan
            create_notification_event(
                db,
                user.id,
                NotificationType.system,
                "Subscription active",
                f"Your {sub.plan.value} subscription is now active.",
                {"event": event, "subscription_id": subscription_id},
            )
    elif event in {"subscription.halted", "subscription.cancelled", "subscription.paused", "payment.failed"}:
        sub.status = "inactive"
        user = db.get(User, sub.user_id)
        if user:
            user.plan_tier = PlanTier.starter
            create_notification_event(
                db,
                user.id,
                NotificationType.risk,
                "Subscription inactive",
                "Your subscription is inactive and has been moved to starter plan access.",
                {"event": event, "subscription_id": subscription_id},
            )
    elif event == "subscription.pending":
        sub.status = "pending"
    elif event in {"subscription.completed", "subscription.authenticated"}:
        sub.status = "active"

    invoice_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
    invoice_id = invoice_entity.get("invoice_id") or payload.get("payload", {}).get("invoice", {}).get("entity", {}).get("id")
    if invoice_id:
        existing_invoice = db.execute(select(InvoiceRecord).where(InvoiceRecord.invoice_id == invoice_id)).scalar_one_or_none()
        if not existing_invoice:
            amount_raw = invoice_entity.get("amount")
            if amount_raw is None:
                amount_raw = payload.get("payload", {}).get("invoice", {}).get("entity", {}).get("amount")
            if amount_raw is None:
                amount_raw = PLAN_MAP[sub.plan.value]["price"] * 100
            amount = float(amount_raw) / 100.0
            invoice_ts = (
                payload.get("payload", {}).get("invoice", {}).get("entity", {}).get("issued_at")
                or payload.get("payload", {}).get("invoice", {}).get("entity", {}).get("created_at")
                or invoice_entity.get("created_at")
            )
            invoice_date = (
                datetime.fromtimestamp(invoice_ts, tz=timezone.utc)
                if isinstance(invoice_ts, (int, float))
                else datetime.now(tz=timezone.utc)
            )
            invoice_record = InvoiceRecord(
                subscription_id=sub.id,
                user_id=sub.user_id,
                invoice_id=invoice_id,
                amount=amount,
                currency=(
                    invoice_entity.get("currency")
                    or payload.get("payload", {}).get("invoice", {}).get("entity", {}).get("currency")
                    or "INR"
                ).upper(),
                status=(
                    payload.get("payload", {}).get("invoice", {}).get("entity", {}).get("status")
                    or invoice_entity.get("status")
                    or sub.status
                ),
                invoice_date=invoice_date,
                period_start=sub.created_at,
                period_end=sub.current_period_end,
                download_url=payload.get("payload", {}).get("invoice", {}).get("entity", {}).get("short_url"),
                payload={"event": event, "subscription_id": subscription_id},
            )
            db.add(invoice_record)

    db.commit()
    return {"processed": True, "event": event, "subscription_id": subscription_id}

