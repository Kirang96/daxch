"""Add fill fields to orders for exchange position tracking

Revision ID: 0007_order_fill_fields
Revises: 0006_ai_units_metering
Create Date: 2026-07-01
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_order_fill_fields"
down_revision: Union[str, None] = "0006_ai_units_metering"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("filled_quantity", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("orders", sa.Column("average_price", sa.Float(), nullable=True))
    op.add_column("orders", sa.Column("transaction_type", sa.String(8), nullable=True))
    op.add_column("orders", sa.Column("broker_status", sa.String(32), nullable=True))
    op.add_column("orders", sa.Column("filled_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "filled_at")
    op.drop_column("orders", "broker_status")
    op.drop_column("orders", "transaction_type")
    op.drop_column("orders", "average_price")
    op.drop_column("orders", "filled_quantity")
