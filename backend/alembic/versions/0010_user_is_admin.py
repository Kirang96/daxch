"""Add is_admin flag to users."""

from alembic import op
import sqlalchemy as sa


revision = "0010_user_is_admin"
down_revision = "0009_user_password_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("users", "is_admin")
