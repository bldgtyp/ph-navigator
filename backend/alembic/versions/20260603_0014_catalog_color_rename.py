"""rename catalog color columns

Revision ID: 20260603_0014
Revises: 20260526_0013
Create Date: 2026-06-03 16:45:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260603_0014"
down_revision: str | None = "20260526_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_VERSION_TABLES = (
    "catalog_material_versions",
    "catalog_frame_type_versions",
    "catalog_glazing_type_versions",
)


def upgrade() -> None:
    for table in _VERSION_TABLES:
        _rename_column_if_present(table, old="argb_color", new="color")


def downgrade() -> None:
    for table in _VERSION_TABLES:
        _rename_column_if_present(table, old="color", new="argb_color")


def _rename_column_if_present(table: str, *, old: str, new: str) -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns(table)}
    if old in columns and new not in columns:
        op.alter_column(table, old, new_column_name=new)
