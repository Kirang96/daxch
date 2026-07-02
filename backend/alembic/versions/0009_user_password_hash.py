"""Add password_hash to users

Revision ID: 0009_user_password_hash
Revises: 0008_initial_entry_decision_type
"""

from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_user_password_hash"
down_revision: Union[str, None] = "0008_initial_entry_decision_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")
