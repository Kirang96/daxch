"""Add trial_ends_at to subscriptions

Revision ID: 0004_trial_subscription
Revises: 0003_launch_hardening
Create Date: 2026-06-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_trial_subscription"
down_revision: Union[str, None] = "0003_launch_hardening"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("subscriptions", sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("subscriptions", "trial_ends_at")
