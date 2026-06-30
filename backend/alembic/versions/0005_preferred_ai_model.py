"""Add preferred_ai_model to user_settings

Revision ID: 0005_preferred_ai_model
Revises: 0004_trial_subscription
Create Date: 2026-06-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_preferred_ai_model"
down_revision: Union[str, None] = "0004_trial_subscription"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("preferred_ai_model", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("user_settings", "preferred_ai_model")
