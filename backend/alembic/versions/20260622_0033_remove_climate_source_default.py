"""remove climate source default flag

Revision ID: 20260622_0033
Revises: 20260621_0032
Create Date: 2026-06-22 10:45:00.000000

The Climate page no longer has a cross-kind "default" source. Phius, PHI,
ASHRAE, and EPW sources are separate reference bases rather than alternatives
for one project-wide selector.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260622_0033"
down_revision: str | None = "20260621_0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("uq_project_climate_source_one_default", table_name="project_climate_source")
    op.drop_column("project_climate_source", "is_default")


def downgrade() -> None:
    op.add_column(
        "project_climate_source",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index(
        "uq_project_climate_source_one_default",
        "project_climate_source",
        ["project_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )
