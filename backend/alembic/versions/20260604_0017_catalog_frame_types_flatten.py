"""flatten catalog_frame_types and add identity / categorization columns

Reshape the frame-types catalog to the flat shape used by the shared
DataTable surface. Mirrors the materials (0015) and glazing (0016)
flattens: ``catalog_frame_type_versions`` goes away, the typed value
columns move onto the identity row, ``source_provenance`` is renamed to
``source`` and ``notes`` to ``comments`` for cross-catalog parity.

Additionally adds seven nullable identity / categorization columns
(``use``, ``operation``, ``location``, ``mull_type``, ``prefix``,
``suffix``, ``material``) to capture how the AirTable seed distinguishes
rows that share a manufacturer + brand.

Destructive: pre-deployment, no users. Existing rows are dropped.

Revision ID: 20260604_0017
Revises: 20260604_0016
Create Date: 2026-06-04 13:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260604_0017"
down_revision: str | None = "20260604_0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Wipe rows up front: the per-version typed values cannot be lifted onto
    # the identity row without picking a "winning" version, and there are no
    # users to migrate.
    op.execute(sa.text("DELETE FROM catalog_frame_type_versions"))
    op.execute(sa.text("DELETE FROM catalog_frame_types"))

    op.drop_index("ix_catalog_frame_type_versions_record", table_name="catalog_frame_type_versions")
    op.drop_constraint("fk_catalog_frame_types_current_version", "catalog_frame_types", type_="foreignkey")
    op.drop_table("catalog_frame_type_versions")
    op.drop_column("catalog_frame_types", "current_version_id")

    # Identity / categorization (soft-enum text per PRD D4).
    op.add_column("catalog_frame_types", sa.Column("manufacturer", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("brand", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("use", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("operation", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("location", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("mull_type", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("prefix", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("suffix", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("material", sa.Text(), nullable=True))

    # Numeric performance properties.
    op.add_column("catalog_frame_types", sa.Column("width_mm", sa.Float(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("u_value_w_m2k", sa.Float(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("psi_g_w_mk", sa.Float(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("psi_install_w_mk", sa.Float(), nullable=True))

    op.add_column("catalog_frame_types", sa.Column("color", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("source", sa.Text(), nullable=True))
    op.add_column("catalog_frame_types", sa.Column("comments", sa.Text(), nullable=True))


def downgrade() -> None:
    raise NotImplementedError("20260604_0017 is destructive (pre-deployment): no downgrade path.")
