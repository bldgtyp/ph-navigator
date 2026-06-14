"""project climate sources

Revision ID: 20260614_0026
Revises: 20260613_0025
Create Date: 2026-06-14 09:00:00.000000

Project-scoped climate *sources* (D-CL-4): one row per attached source a
project evaluates. Unlike the app-wide `climate_dataset*` tables, these are
per-project. `kind` selects how `ref`/`data` are interpreted:

* `phius` / `phi` — `ref` is a `climate_dataset_location.id` (a pinned
  reference-dataset location); `data` is null.
* `epw`           — `ref` is the project's EPW `asset.id`; `data` is null.
* `ashrae`        — `ref` is the ASHRAE station id; `data` may hold a small
  pointer payload (e.g. the meteo URL / cached values).
* `custom`        — `data` holds a standardized `ClimateRecord` (D-CL-9);
  `ref` is null.

At most one source per project is the default (D-CL-11), enforced by a
partial unique index.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260614_0026"
down_revision: str | None = "20260613_0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_climate_source",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("ref", sa.Text(), nullable=True),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("data", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "kind IN ('phius', 'phi', 'ashrae', 'epw', 'custom')",
            name="ck_project_climate_source_kind",
        ),
    )
    op.create_index("ix_project_climate_source_project", "project_climate_source", ["project_id"])
    # At most one default source per project (D-CL-11).
    op.create_index(
        "uq_project_climate_source_one_default",
        "project_climate_source",
        ["project_id"],
        unique=True,
        postgresql_where=sa.text("is_default"),
    )


def downgrade() -> None:
    op.drop_index("uq_project_climate_source_one_default", table_name="project_climate_source")
    op.drop_index("ix_project_climate_source_project", table_name="project_climate_source")
    op.drop_table("project_climate_source")
