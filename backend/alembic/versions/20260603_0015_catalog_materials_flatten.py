"""flatten catalog_materials and drop the version layer

Reshape the materials catalog to the nine-field contract used by the
shared DataTable surface. The bookshelf snapshot pattern in
``features/envelope/commands/materials.py`` already protects historical
projects from catalog edits, so the per-version row is dead weight: the
``catalog_material_versions`` table and ``catalog_materials.current_version_id``
column go away, and the typed value columns move onto the identity row.

Destructive: pre-deployment, no users. Existing rows are dropped.

Revision ID: 20260603_0015
Revises: 20260603_0014
Create Date: 2026-06-03 21:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260603_0015"
down_revision: str | None = "20260603_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_CATEGORY_OPTION_IDS = (
    "insulation",
    "finishes",
    "woods",
    "metals",
    "masonry",
    "stud_layers_steel",
    "stud_layers_wood",
    "air_horizontal_heat_flow",
    "air_upward_heat_flow",
    "air_downward_heat_flow",
    "rainscreen_insulation",
    "doors",
)


def upgrade() -> None:
    # Wipe rows up front: the existing per-version typed values cannot be
    # safely lifted onto the identity row without picking a "winning"
    # version, and there are no users to migrate.
    op.execute(sa.text("DELETE FROM catalog_material_versions"))
    op.execute(sa.text("DELETE FROM catalog_materials"))

    op.drop_index("ix_catalog_material_versions_record", table_name="catalog_material_versions")
    op.drop_constraint("fk_catalog_materials_current_version", "catalog_materials", type_="foreignkey")
    op.drop_table("catalog_material_versions")
    op.drop_column("catalog_materials", "current_version_id")

    op.add_column("catalog_materials", sa.Column("density_kg_m3", sa.Float(), nullable=True))
    op.add_column("catalog_materials", sa.Column("specific_heat_j_kgk", sa.Float(), nullable=True))
    op.add_column("catalog_materials", sa.Column("conductivity_w_mk", sa.Float(), nullable=True))
    op.add_column("catalog_materials", sa.Column("emissivity", sa.Float(), nullable=True))
    op.add_column("catalog_materials", sa.Column("color", sa.Text(), nullable=True))
    op.add_column("catalog_materials", sa.Column("source", sa.Text(), nullable=True))
    op.add_column("catalog_materials", sa.Column("url", sa.Text(), nullable=True))
    op.add_column("catalog_materials", sa.Column("comments", sa.Text(), nullable=True))

    quoted = ", ".join(f"'{option_id}'" for option_id in _CATEGORY_OPTION_IDS)
    op.create_check_constraint(
        "ck_catalog_materials_category",
        "catalog_materials",
        f"category IN ({quoted})",
    )


def downgrade() -> None:
    raise NotImplementedError(
        "20260603_0015 is destructive (pre-deployment): no downgrade path."
    )
