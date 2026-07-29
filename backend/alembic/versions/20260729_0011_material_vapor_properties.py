"""add vapor resistance properties to catalog materials

Revision ID: 20260729_0011
Revises: 20260728_0010
Create Date: 2026-07-29 12:00:00.000000

Both columns are nullable so existing catalog rows retain their current
meaning: vapor data has not been recorded. Values stay SI-canonical:
dimensionless material resistance factor (mu) and equivalent air-layer
thickness (sd) in metres.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260729_0011"
down_revision: str | None = "20260728_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE catalog_materials ADD COLUMN vapor_diffusion_resistance_mu double precision")
    op.execute("ALTER TABLE catalog_materials ADD COLUMN vapor_sd_equivalent_m double precision")
    op.execute(
        """
        ALTER TABLE catalog_materials
        ADD CONSTRAINT ck_catalog_materials_vapor_mu_minimum
        CHECK (vapor_diffusion_resistance_mu IS NULL OR vapor_diffusion_resistance_mu >= 1)
        """
    )
    op.execute(
        """
        ALTER TABLE catalog_materials
        ADD CONSTRAINT ck_catalog_materials_vapor_sd_non_negative
        CHECK (vapor_sd_equivalent_m IS NULL OR vapor_sd_equivalent_m >= 0)
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE catalog_materials DROP CONSTRAINT ck_catalog_materials_vapor_sd_non_negative")
    op.execute("ALTER TABLE catalog_materials DROP CONSTRAINT ck_catalog_materials_vapor_mu_minimum")
    op.execute("ALTER TABLE catalog_materials DROP COLUMN vapor_sd_equivalent_m")
    op.execute("ALTER TABLE catalog_materials DROP COLUMN vapor_diffusion_resistance_mu")
