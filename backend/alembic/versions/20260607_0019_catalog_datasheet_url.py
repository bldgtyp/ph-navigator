"""add datasheet_url column to catalog_frame_types and catalog_glazing_types

Apertures cleanup §B.2: explicit ``datasheet_url`` column on the frame and
glazing catalog tables, mirrored on the in-document ``FrameRef`` /
``GlazingRef`` (the JSON shape gets the field for free via the optional
Pydantic default). Nullable text; max 400 chars enforced at the model
layer.

Revision ID: 20260607_0019
Revises: 20260605_0018
Create Date: 2026-06-07 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260607_0019"
down_revision: str | None = "20260605_0018"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("catalog_frame_types", sa.Column("datasheet_url", sa.Text(), nullable=True))
    op.add_column("catalog_glazing_types", sa.Column("datasheet_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("catalog_glazing_types", "datasheet_url")
    op.drop_column("catalog_frame_types", "datasheet_url")
