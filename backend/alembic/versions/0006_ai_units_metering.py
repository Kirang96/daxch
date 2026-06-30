"""AI units metering tables and ultra plan tier

Revision ID: 0006_ai_units_metering
Revises: 0005_preferred_ai_model
Create Date: 2026-06-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_ai_units_metering"
down_revision: Union[str, None] = "0005_preferred_ai_model"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE plantier ADD VALUE IF NOT EXISTS 'ultra'")

    op.create_table(
        "ai_usage_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("operation_type", sa.String(32), nullable=False),
        sa.Column("model", sa.String(64), nullable=False),
        sa.Column("strategy_id", sa.String(64), nullable=True),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ticker", sa.String(32), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tavily_credits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("units_charged", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_ai_usage_events_user_id", "ai_usage_events", ["user_id"])

    op.create_table(
        "user_ai_usage_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("units_consumed_from_plan", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("warning_thresholds_sent", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "period_start", name="uq_user_ai_usage_period"),
    )
    op.create_index("ix_user_ai_usage_summaries_user_id", "user_ai_usage_summaries", ["user_id"])

    op.create_table(
        "user_ai_bonus_balances",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "ai_unit_topup_purchases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("pack_id", sa.String(32), nullable=False),
        sa.Column("units_granted", sa.Integer(), nullable=False),
        sa.Column("amount_inr", sa.Integer(), nullable=False),
        sa.Column("razorpay_order_id", sa.String(128), nullable=False),
        sa.Column("razorpay_payment_id", sa.String(128), nullable=True),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("razorpay_order_id", name="uq_ai_topup_razorpay_order_id"),
        sa.UniqueConstraint("razorpay_payment_id", name="uq_ai_topup_razorpay_payment_id"),
    )
    op.create_index("ix_ai_unit_topup_purchases_user_id", "ai_unit_topup_purchases", ["user_id"])


def downgrade() -> None:
    op.drop_table("ai_unit_topup_purchases")
    op.drop_table("user_ai_bonus_balances")
    op.drop_table("user_ai_usage_summaries")
    op.drop_table("ai_usage_events")
