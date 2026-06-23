"""stat + ddy asset kinds

Revision ID: 20260623_0035
Revises: 20260622_0034
Create Date: 2026-06-23 01:30:00.000000

The "Upload Climate Data" modal (Climate P3) uploads the EPW's `.stat` and
`.ddy` companions as standalone assets, so the project_assets kind constraint
must admit them alongside `epw`.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260623_0035"
down_revision: str | None = "20260622_0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CONSTRAINT = "project_assets_kind_allowed"
_TABLE = "project_assets"
_WITH_COMPANIONS = (
    "asset_kind IN ('datasheet', 'site_photo', 'hbjson', 'simulation_file', "
    "'export_bundle', 'epw', 'stat', 'ddy', 'other')"
)
_WITHOUT_COMPANIONS = (
    "asset_kind IN ('datasheet', 'site_photo', 'hbjson', 'simulation_file', 'export_bundle', 'epw', 'other')"
)


def upgrade() -> None:
    op.drop_constraint(_CONSTRAINT, _TABLE, type_="check")
    op.create_check_constraint(_CONSTRAINT, _TABLE, sa.text(_WITH_COMPANIONS))


def downgrade() -> None:
    op.drop_constraint(_CONSTRAINT, _TABLE, type_="check")
    op.create_check_constraint(_CONSTRAINT, _TABLE, sa.text(_WITHOUT_COMPANIONS))
