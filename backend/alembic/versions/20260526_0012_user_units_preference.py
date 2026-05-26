"""user units preference

Revision ID: 20260526_0012
Revises: 20260526_0011
Create Date: 2026-05-26 18:50:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260526_0012"
down_revision: str | None = "20260526_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("units_preference", sa.Text(), nullable=False, server_default="SI"),
    )
    op.create_check_constraint(
        "users_units_preference_allowed",
        "users",
        "units_preference IN ('SI', 'IP')",
    )


def downgrade() -> None:
    op.drop_constraint("users_units_preference_allowed", "users", type_="check")
    op.drop_column("users", "units_preference")
