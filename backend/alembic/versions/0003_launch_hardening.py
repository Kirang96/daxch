"""launch hardening tables

Revision ID: 0003_launch_hardening
Revises: 0002_feature_wiring_tables
Create Date: 2026-06-30 14:40:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003_launch_hardening"
down_revision: str | None = "0002_feature_wiring_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "device_tokens" not in inspector.get_table_names():
        op.create_table(
            "device_tokens",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("token", sa.String(length=255), nullable=False),
            sa.Column("platform", sa.String(length=32), nullable=False, server_default="unknown"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    inspector = sa.inspect(bind)
    device_indexes = {idx["name"] for idx in inspector.get_indexes("device_tokens")}
    if "ix_device_tokens_user_id" not in device_indexes:
        op.create_index("ix_device_tokens_user_id", "device_tokens", ["user_id"], unique=False)
    if "ix_device_tokens_token" not in device_indexes:
        op.create_index("ix_device_tokens_token", "device_tokens", ["token"], unique=True)

    if "webhook_events" not in inspector.get_table_names():
        op.create_table(
            "webhook_events",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("source", sa.String(length=32), nullable=False),
            sa.Column("event_hash", sa.String(length=128), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
    inspector = sa.inspect(bind)
    webhook_indexes = {idx["name"] for idx in inspector.get_indexes("webhook_events")}
    if "ix_webhook_events_event_hash" not in webhook_indexes:
        op.create_index("ix_webhook_events_event_hash", "webhook_events", ["event_hash"], unique=True)

    invoice_indexes = {idx["name"]: idx for idx in inspector.get_indexes("invoice_records")}
    existing_invoice_idx = invoice_indexes.get("ix_invoice_records_invoice_id")
    if existing_invoice_idx and not existing_invoice_idx.get("unique", False):
        op.drop_index("ix_invoice_records_invoice_id", table_name="invoice_records")
        op.create_index("ix_invoice_records_invoice_id", "invoice_records", ["invoice_id"], unique=True)
    elif not existing_invoice_idx:
        op.create_index("ix_invoice_records_invoice_id", "invoice_records", ["invoice_id"], unique=True)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if "invoice_records" in inspector.get_table_names():
        invoice_indexes = {idx["name"] for idx in inspector.get_indexes("invoice_records")}
        if "ix_invoice_records_invoice_id" in invoice_indexes:
            op.drop_index("ix_invoice_records_invoice_id", table_name="invoice_records")
        op.create_index("ix_invoice_records_invoice_id", "invoice_records", ["invoice_id"], unique=False)

    if "webhook_events" in inspector.get_table_names():
        webhook_indexes = {idx["name"] for idx in inspector.get_indexes("webhook_events")}
        if "ix_webhook_events_event_hash" in webhook_indexes:
            op.drop_index("ix_webhook_events_event_hash", table_name="webhook_events")
        op.drop_table("webhook_events")

    if "device_tokens" in inspector.get_table_names():
        device_indexes = {idx["name"] for idx in inspector.get_indexes("device_tokens")}
        if "ix_device_tokens_token" in device_indexes:
            op.drop_index("ix_device_tokens_token", table_name="device_tokens")
        if "ix_device_tokens_user_id" in device_indexes:
            op.drop_index("ix_device_tokens_user_id", table_name="device_tokens")
        op.drop_table("device_tokens")

