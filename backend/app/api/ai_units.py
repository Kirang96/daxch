from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.middleware.auth import get_current_user
from backend.app.models.entities import AgentStatus, AiUnitTopupPurchase, MonitorAgent, StockHolding, User
from backend.app.schemas.ai_units import (
    AiUnitsEstimateResponse,
    AiUnitsQuotaResponse,
    TopupConfirmRequest,
    TopupOrderResponse,
    TopupPackResponse,
    TopupPurchaseResponse,
)
from backend.app.services.ai.user_model import get_resolved_ai_model
from backend.app.services.ai_units.service import AiUnitsService
from backend.app.services.ai_units.topup_packs import get_topup_pack, list_topup_packs
from backend.app.services.payment import PaymentConfigurationError, PaymentService
from backend.app.services.subscription_access import require_platform_access

router = APIRouter(prefix="/ai-units", tags=["ai-units"])
payment_service = PaymentService()


@router.get("/current", response_model=AiUnitsQuotaResponse)
def get_current_quota(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiUnitsQuotaResponse:
    quota = AiUnitsService.get_quota(db, current_user)
    return AiUnitsQuotaResponse(
        plan_allowance=quota.plan_allowance,
        plan_remaining=quota.plan_remaining,
        plan_consumed=quota.plan_consumed,
        bonus_balance=quota.bonus_balance,
        total_remaining=quota.total_remaining,
        total_used=quota.total_used,
        total_limit=quota.total_limit,
        percent_used=quota.percent_used,
        period_start=quota.period_start,
        period_end=quota.period_end,
        has_active_subscription=quota.has_active_subscription,
    )


@router.get("/estimate/portfolio", response_model=AiUnitsEstimateResponse)
def estimate_portfolio(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiUnitsEstimateResponse:
    model = get_resolved_ai_model(db, current_user)
    stmt = (
        select(MonitorAgent)
        .join(StockHolding, MonitorAgent.holding_id == StockHolding.id)
        .where(StockHolding.user_id == current_user.id, MonitorAgent.status == AgentStatus.active)
    )
    agents = db.execute(stmt).scalars().all()
    total_daily = sum(agent.polling_frequency for agent in agents)
    estimated = AiUnitsService.estimate_portfolio_monthly_units(total_daily_polls=total_daily, model=model)
    return AiUnitsEstimateResponse(
        estimated_monthly_units=estimated,
        total_daily_polls=total_daily,
        model=model,
    )


@router.get("/estimate/agent", response_model=AiUnitsEstimateResponse)
def estimate_agent(
    frequency: int = 2,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiUnitsEstimateResponse:
    model = get_resolved_ai_model(db, current_user)
    estimated = AiUnitsService.estimate_portfolio_monthly_units(total_daily_polls=max(2, frequency), model=model)
    return AiUnitsEstimateResponse(
        estimated_monthly_units=estimated,
        total_daily_polls=max(2, frequency),
        model=model,
    )


@router.get("/topup-packs", response_model=list[TopupPackResponse])
def topup_packs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TopupPackResponse]:
    require_platform_access(db, current_user)
    return [
        TopupPackResponse(id=pack.id, units=pack.units, price_inr=pack.price_inr, label=pack.label)
        for pack in list_topup_packs()
    ]


@router.post("/topup", response_model=TopupOrderResponse)
async def create_topup(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TopupOrderResponse:
    require_platform_access(db, current_user)
    pack_id = str(payload.get("pack_id", "")).strip()
    pack = get_topup_pack(pack_id)
    if pack is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown top-up pack")
    try:
        order_data = await payment_service.create_topup_order(pack_id=pack.id, user_email=current_user.email)
    except PaymentConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    purchase = AiUnitTopupPurchase(
        user_id=current_user.id,
        pack_id=pack.id,
        units_granted=pack.units,
        amount_inr=pack.price_inr,
        razorpay_order_id=order_data["order_id"],
        status="pending",
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    settings = get_settings()
    return TopupOrderResponse(
        order_id=order_data["order_id"],
        amount=order_data["amount"],
        currency=order_data.get("currency", "INR"),
        key_id=settings.razorpay_key_id,
        purchase_id=str(purchase.id),
        pack_id=pack.id,
        units=pack.units,
    )


@router.post("/topup/confirm")
def confirm_topup(
    payload: TopupConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_platform_access(db, current_user)
    try:
        payment_service.verify_payment_signature(payload.order_id, payload.payment_id, payload.signature)
    except PaymentConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    purchase = db.execute(
        select(AiUnitTopupPurchase).where(
            AiUnitTopupPurchase.razorpay_order_id == payload.order_id,
            AiUnitTopupPurchase.user_id == current_user.id,
        )
    ).scalar_one_or_none()
    if purchase is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Top-up purchase not found")
    if purchase.status == "paid":
        return {"status": "paid", "purchase_id": str(purchase.id)}

    existing = db.execute(
        select(AiUnitTopupPurchase).where(AiUnitTopupPurchase.razorpay_payment_id == payload.payment_id)
    ).scalar_one_or_none()
    if existing and existing.id != purchase.id:
        return {"status": "paid", "purchase_id": str(existing.id)}

    purchase.razorpay_payment_id = payload.payment_id
    AiUnitsService.credit_bonus(db, current_user.id, purchase.units_granted, purchase.id)
    db.commit()
    return {"status": "paid", "purchase_id": str(purchase.id)}


@router.post("/topup/dev-credit")
def dev_credit_topup(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    settings = get_settings()
    if settings.environment != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not available")
    pack_id = str(payload.get("pack_id", "boost_5k")).strip()
    pack = get_topup_pack(pack_id)
    if pack is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown pack")
    purchase = AiUnitTopupPurchase(
        user_id=current_user.id,
        pack_id=pack.id,
        units_granted=pack.units,
        amount_inr=pack.price_inr,
        razorpay_order_id=f"dev_{current_user.id}_{pack.id}",
        razorpay_payment_id=f"dev_pay_{current_user.id}_{pack.id}",
        status="pending",
    )
    db.add(purchase)
    db.flush()
    AiUnitsService.credit_bonus(db, current_user.id, pack.units, purchase.id)
    db.commit()
    return {"status": "paid", "units": pack.units}


@router.get("/purchases", response_model=list[TopupPurchaseResponse])
def list_purchases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TopupPurchaseResponse]:
    rows = db.execute(
        select(AiUnitTopupPurchase)
        .where(AiUnitTopupPurchase.user_id == current_user.id)
        .order_by(AiUnitTopupPurchase.created_at.desc())
    ).scalars().all()
    return [
        TopupPurchaseResponse(
            id=str(row.id),
            pack_id=row.pack_id,
            units_granted=row.units_granted,
            amount_inr=row.amount_inr,
            status=row.status,
            created_at=row.created_at,
            paid_at=row.paid_at,
        )
        for row in rows
    ]
