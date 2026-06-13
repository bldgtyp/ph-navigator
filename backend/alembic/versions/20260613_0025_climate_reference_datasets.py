"""climate reference datasets

Revision ID: 20260613_0025
Revises: 20260612_0024
Create Date: 2026-06-13 11:00:00.000000

App-wide (NOT project-scoped) versioned reference climate datasets:
`climate_dataset` is one row per (provider, version); each row owns many
`climate_dataset_location` rows, each carrying a standardized
`ClimateRecord` in `data` (JSONB). Immutable once seeded — a new release
is a new `climate_dataset` row, never an in-place edit (D-CL-8).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260613_0025"
down_revision: str | None = "20260612_0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "climate_dataset",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "version", name="uq_climate_dataset_provider_version"),
    )

    op.create_table(
        "climate_dataset_location",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("dataset_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("country", sa.Text(), nullable=True),
        sa.Column("region", sa.Text(), nullable=True),
        sa.Column("climate_zone", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Double(), nullable=True),
        sa.Column("longitude", sa.Double(), nullable=True),
        sa.Column("elevation_m", sa.Double(), nullable=True),
        sa.Column("station_id", sa.Text(), nullable=True),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["climate_dataset.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    # Filter by political geography (the PHI/PHPP dropdown path).
    op.create_index(
        "ix_climate_dataset_location_geo",
        "climate_dataset_location",
        ["dataset_id", "country", "region"],
    )
    # Bounding-box prefilter for nearest-station search; the exact
    # ordering is done in SQL over this candidate set.
    op.create_index(
        "ix_climate_dataset_location_latlong",
        "climate_dataset_location",
        ["dataset_id", "latitude", "longitude"],
    )


def downgrade() -> None:
    op.drop_index("ix_climate_dataset_location_latlong", table_name="climate_dataset_location")
    op.drop_index("ix_climate_dataset_location_geo", table_name="climate_dataset_location")
    op.drop_table("climate_dataset_location")
    op.drop_table("climate_dataset")
