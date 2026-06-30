from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models.entities import InvoiceRecord, Subscription, User
from backend.app.services.subscription_access import get_latest_subscription, has_platform_access


@dataclass(frozen=True)
class BillingPeriod:
    period_start: datetime
    period_end: datetime


def _calendar_month_period(now: datetime) -> BillingPeriod:
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return BillingPeriod(period_start=start, period_end=end)


def resolve_billing_period(db: Session, user: User, now: datetime | None = None) -> BillingPeriod:
    now = now or datetime.now(tz=timezone.utc)
    sub = get_latest_subscription(db, user.id)
    if sub and has_platform_access(sub, now) and sub.current_period_end:
        period_end = sub.current_period_end
        if period_end.tzinfo is None:
            period_end = period_end.replace(tzinfo=timezone.utc)

        invoice = db.execute(
            select(InvoiceRecord)
            .where(InvoiceRecord.user_id == user.id, InvoiceRecord.subscription_id == sub.id)
            .order_by(InvoiceRecord.invoice_date.desc())
        ).scalars().first()
        if invoice and invoice.period_start:
            period_start = invoice.period_start
            if period_start.tzinfo is None:
                period_start = period_start.replace(tzinfo=timezone.utc)
        else:
            period_start = period_end - timedelta(days=30)
        return BillingPeriod(period_start=period_start, period_end=period_end)

    return _calendar_month_period(now)
