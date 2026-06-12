"""epw asset kind

Revision ID: 20260612_0024
Revises: 20260612_0023
Create Date: 2026-06-12 21:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260612_0024"
down_revision: str | None = "20260612_0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ASSET_KINDS_WITH_EPW = (
    "asset_kind IN ('datasheet', 'site_photo', 'hbjson', 'simulation_file', 'export_bundle', 'epw', 'other')"
)
ASSET_KINDS_WITHOUT_EPW = (
    "asset_kind IN ('datasheet', 'site_photo', 'hbjson', 'simulation_file', 'export_bundle', 'other')"
)


def upgrade() -> None:
    op.drop_constraint("project_assets_kind_allowed", "project_assets", type_="check")
    op.create_check_constraint("project_assets_kind_allowed", "project_assets", sa.text(ASSET_KINDS_WITH_EPW))


def downgrade() -> None:
    op.drop_constraint("project_assets_kind_allowed", "project_assets", type_="check")
    op.create_check_constraint("project_assets_kind_allowed", "project_assets", sa.text(ASSET_KINDS_WITHOUT_EPW))
