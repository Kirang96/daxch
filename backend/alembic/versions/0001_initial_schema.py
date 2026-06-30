"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-06-30 10:55:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    plan_tier = sa.Enum("starter", "pro", name="plantier")
    holding_status = sa.Enum("active", "sold", name="holdingstatus")
    agent_status = sa.Enum("active", "paused", "stopped", name="agentstatus")
    decision_type = sa.Enum("buy_more", "sell", "hold", name="decisiontype")
    confirmation_status = sa.Enum("pending", "approved", "rejected", "auto_executed", name="confirmationstatus")
    order_status = sa.Enum("pending", "placed", "failed", "cancelled", name="orderstatus")

    plan_tier.create(op.get_bind(), checkfirst=True)
    holding_status.create(op.get_bind(), checkfirst=True)
    agent_status.create(op.get_bind(), checkfirst=True)
    decision_type.create(op.get_bind(), checkfirst=True)
    confirmation_status.create(op.get_bind(), checkfirst=True)
    order_status.create(op.get_bind(), checkfirst=True)

    plan_tier = postgresql.ENUM("starter", "pro", name="plantier", create_type=False)
    holding_status = postgresql.ENUM("active", "sold", name="holdingstatus", create_type=False)
    agent_status = postgresql.ENUM("active", "paused", "stopped", name="agentstatus", create_type=False)
    decision_type = postgresql.ENUM("buy_more", "sell", "hold", name="decisiontype", create_type=False)
    confirmation_status = postgresql.ENUM("pending", "approved", "rejected", "auto_executed", name="confirmationstatus", create_type=False)
    order_status = postgresql.ENUM("pending", "placed", "failed", "cancelled", name="orderstatus", create_type=False)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("plan_tier", plan_tier, nullable=False, server_default="starter"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "broker_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("broker_name", sa.String(length=64), nullable=False),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "stock_holdings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("exchange", sa.String(length=32), nullable=False),
        sa.Column("entry_price", sa.Float(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("intention", sa.String(length=64), nullable=False),
        sa.Column("status", holding_status, nullable=False, server_default="active"),
        sa.Column("bought_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_stock_holdings_ticker", "stock_holdings", ["ticker"], unique=False)

    op.create_table(
        "monitor_agents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("holding_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stock_holdings.id"), nullable=False, unique=True),
        sa.Column("polling_frequency", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("status", agent_status, nullable=False, server_default="active"),
        sa.Column("next_poll_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("agent_config", sa.JSON(), nullable=False),
    )

    op.create_table(
        "agent_decisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monitor_agents.id"), nullable=False),
        sa.Column("decision_type", decision_type, nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=False),
        sa.Column("analysis_data", sa.JSON(), nullable=False),
        sa.Column("confirmation_status", confirmation_status, nullable=False, server_default="pending"),
        sa.Column("confirmation_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("decision_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("agent_decisions.id"), nullable=False, unique=True),
        sa.Column("broker_order_id", sa.String(length=128), nullable=True),
        sa.Column("order_type", sa.String(length=16), nullable=False),
        sa.Column("status", order_status, nullable=False, server_default="pending"),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("agent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monitor_agents.id"), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan", plan_tier, nullable=False),
        sa.Column("razorpay_sub_id", sa.String(length=128), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("subscriptions")
    op.drop_table("audit_logs")
    op.drop_table("orders")
    op.drop_table("agent_decisions")
    op.drop_table("monitor_agents")
    op.drop_index("ix_stock_holdings_ticker", table_name="stock_holdings")
    op.drop_table("stock_holdings")
    op.drop_table("broker_connections")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS orderstatus")
    op.execute("DROP TYPE IF EXISTS confirmationstatus")
    op.execute("DROP TYPE IF EXISTS decisiontype")
    op.execute("DROP TYPE IF EXISTS agentstatus")
    op.execute("DROP TYPE IF EXISTS holdingstatus")
    op.execute("DROP TYPE IF EXISTS plantier")

