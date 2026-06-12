"""project location

Revision ID: 20260612_0023
Revises: 20260612_0022
Create Date: 2026-06-12 18:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260612_0023"
down_revision: str | None = "20260612_0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_location",
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("latitude", sa.Double(), nullable=True),
        sa.Column("longitude", sa.Double(), nullable=True),
        sa.Column("elevation_m", sa.Double(), nullable=True),
        sa.Column("time_zone", sa.Text(), nullable=True),
        sa.Column("true_north_deg", sa.Double(), nullable=True),
        sa.Column("site_address", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("state", sa.Text(), nullable=True),
        sa.Column("epw_asset_id", sa.Text(), nullable=True),
        sa.Column("epw_source_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("project_id"),
    )


def downgrade() -> None:
    op.drop_table("project_location")
