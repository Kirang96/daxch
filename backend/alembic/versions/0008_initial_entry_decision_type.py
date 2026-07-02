"""Add initial_entry to decisiontype enum

Revision ID: 0008_initial_entry_decision_type
Revises: 0007_order_fill_fields
Create Date: 2026-07-01
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0008_initial_entry_decision_type"
down_revision: Union[str, None] = "0007_order_fill_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE decisiontype ADD VALUE IF NOT EXISTS 'initial_entry'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values safely.
    pass
