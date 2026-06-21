"""project location derived geodata

Revision ID: 20260621_0032
Revises: 20260616_0031
Create Date: 2026-06-21 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260621_0032"
down_revision: str | None = "20260616_0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("project_location", sa.Column("county", sa.Text(), nullable=True))
    op.add_column("project_location", sa.Column("county_fips", sa.Text(), nullable=True))
    op.add_column("project_location", sa.Column("country", sa.Text(), nullable=True))
    op.add_column("project_location", sa.Column("climate_zone", sa.Text(), nullable=True))
    op.add_column(
        "project_location",
        sa.Column(
            "geodata_provenance",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )


def downgrade() -> None:
    op.drop_column("project_location", "geodata_provenance")
    op.drop_column("project_location", "climate_zone")
    op.drop_column("project_location", "country")
    op.drop_column("project_location", "county_fips")
    op.drop_column("project_location", "county")
