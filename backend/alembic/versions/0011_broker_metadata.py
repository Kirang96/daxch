"""Add broker connection_metadata and order broker_metadata

Revision ID: 0011_broker_metadata
Revises: 0010_user_is_admin
Create Date: 2026-07-03
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011_broker_metadata"
down_revision = "0010_user_is_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "broker_connections",
        sa.Column("connection_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )
    op.add_column(
        "orders",
        sa.Column("broker_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=False, server_default="{}"),
    )


def downgrade() -> None:
    op.drop_column("orders", "broker_metadata")
    op.drop_column("broker_connections", "connection_metadata")
