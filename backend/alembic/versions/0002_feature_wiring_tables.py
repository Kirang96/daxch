"""feature wiring tables

Revision ID: 0002_feature_wiring_tables
Revises: 0001_initial_schema
Create Date: 2026-06-30 13:35:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0002_feature_wiring_tables"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    notification_type = sa.Enum("market", "agent", "news", "risk", "technical", "system", name="notificationtype")
    notification_type.create(op.get_bind(), checkfirst=True)
    notification_type = postgresql.ENUM("market", "agent", "news", "risk", "technical", "system", name="notificationtype", create_type=False)

    op.create_table(
        "watchlist_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("ticker", sa.String(length=32), nullable=False),
        sa.Column("exchange", sa.String(length=32), nullable=False, server_default="NSE"),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("target_price", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_watchlist_items_ticker", "watchlist_items", ["ticker"], unique=False)
    op.create_index("ix_watchlist_items_user_id", "watchlist_items", ["user_id"], unique=False)

    op.create_table(
        "notification_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_type", notification_type, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notification_events_user_id", "notification_events", ["user_id"], unique=False)
    op.create_index("ix_notification_events_created_at", "notification_events", ["created_at"], unique=False)

    op.create_table(
        "user_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("profile_name", sa.String(length=255), nullable=True),
        sa.Column("timezone", sa.String(length=64), nullable=True),
        sa.Column("preferred_currency", sa.String(length=16), nullable=True),
        sa.Column("notification_preferences", sa.JSON(), nullable=False),
        sa.Column("security_preferences", sa.JSON(), nullable=False),
        sa.Column("api_connections", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "invoice_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("subscriptions.id"), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invoice_id", sa.String(length=128), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(length=16), nullable=False, server_default="INR"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="issued"),
        sa.Column("invoice_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("download_url", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_invoice_records_user_id", "invoice_records", ["user_id"], unique=False)
    op.create_index("ix_invoice_records_invoice_id", "invoice_records", ["invoice_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_invoice_records_invoice_id", table_name="invoice_records")
    op.drop_index("ix_invoice_records_user_id", table_name="invoice_records")
    op.drop_table("invoice_records")

    op.drop_table("user_settings")

    op.drop_index("ix_notification_events_created_at", table_name="notification_events")
    op.drop_index("ix_notification_events_user_id", table_name="notification_events")
    op.drop_table("notification_events")

    op.drop_index("ix_watchlist_items_user_id", table_name="watchlist_items")
    op.drop_index("ix_watchlist_items_ticker", table_name="watchlist_items")
    op.drop_table("watchlist_items")

    op.execute("DROP TYPE IF EXISTS notificationtype")

