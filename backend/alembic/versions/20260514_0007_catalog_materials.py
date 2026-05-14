"""catalog materials

Revision ID: 20260514_0007
Revises: 20260512_0006
Create Date: 2026-05-14 12:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260514_0007"
down_revision: str | None = "20260512_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Identity rows. current_version_id is created without an FK and the
    # constraint is added after the versions table exists to avoid the
    # circular reference at create time.
    op.create_table(
        "catalog_materials",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("current_version_id", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_by", sa.Uuid(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "catalog_material_versions",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("record_id", sa.Text(), nullable=False),
        sa.Column("version_label", sa.Text(), nullable=False),
        sa.Column("version_date", sa.Date(), nullable=False),
        sa.Column("catalog_schema_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("conductivity_w_mk", sa.Float(), nullable=True),
        sa.Column("density_kg_m3", sa.Float(), nullable=True),
        sa.Column("specific_heat_j_kgk", sa.Float(), nullable=True),
        sa.Column("emissivity", sa.Float(), nullable=True),
        sa.Column("argb_color", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source_provenance", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["record_id"], ["catalog_materials.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_foreign_key(
        "fk_catalog_materials_current_version",
        "catalog_materials",
        "catalog_material_versions",
        ["current_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_catalog_materials_active_name",
        "catalog_materials",
        ["name"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_catalog_material_versions_record",
        "catalog_material_versions",
        ["record_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_catalog_material_versions_record", table_name="catalog_material_versions")
    op.drop_index("ix_catalog_materials_active_name", table_name="catalog_materials")
    op.drop_constraint("fk_catalog_materials_current_version", "catalog_materials", type_="foreignkey")
    op.drop_table("catalog_material_versions")
    op.drop_table("catalog_materials")
