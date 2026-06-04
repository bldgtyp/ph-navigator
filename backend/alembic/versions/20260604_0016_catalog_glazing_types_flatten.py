"""flatten catalog_glazing_types and drop the version layer

Reshape the glazing-types catalog to the flat nine-field contract used by
the shared DataTable surface. Mirrors the materials flatten in 0015:
``catalog_glazing_type_versions`` goes away, the typed value columns move
onto the identity row, ``source_provenance`` is renamed to ``source`` and
``notes`` to ``comments`` for cross-catalog parity, and a new ``suffix``
column is added to capture the AirTable variant code.

Destructive: pre-deployment, no users. Existing rows are dropped.

Revision ID: 20260604_0016
Revises: 20260603_0015
Create Date: 2026-06-04 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260604_0016"
down_revision: str | None = "20260603_0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Wipe rows up front: the per-version typed values cannot be lifted onto
    # the identity row without picking a "winning" version, and there are no
    # users to migrate.
    op.execute(sa.text("DELETE FROM catalog_glazing_type_versions"))
    op.execute(sa.text("DELETE FROM catalog_glazing_types"))

    op.drop_index("ix_catalog_glazing_type_versions_record", table_name="catalog_glazing_type_versions")
    op.drop_constraint("fk_catalog_glazing_types_current_version", "catalog_glazing_types", type_="foreignkey")
    op.drop_table("catalog_glazing_type_versions")
    op.drop_column("catalog_glazing_types", "current_version_id")

    op.add_column("catalog_glazing_types", sa.Column("manufacturer", sa.Text(), nullable=True))
    op.add_column("catalog_glazing_types", sa.Column("brand", sa.Text(), nullable=True))
    op.add_column("catalog_glazing_types", sa.Column("suffix", sa.Text(), nullable=True))
    op.add_column("catalog_glazing_types", sa.Column("u_value_w_m2k", sa.Float(), nullable=True))
    op.add_column("catalog_glazing_types", sa.Column("g_value", sa.Float(), nullable=True))
    op.add_column("catalog_glazing_types", sa.Column("color", sa.Text(), nullable=True))
    op.add_column("catalog_glazing_types", sa.Column("source", sa.Text(), nullable=True))
    op.add_column("catalog_glazing_types", sa.Column("comments", sa.Text(), nullable=True))


def downgrade() -> None:
    raise NotImplementedError("20260604_0016 is destructive (pre-deployment): no downgrade path.")
