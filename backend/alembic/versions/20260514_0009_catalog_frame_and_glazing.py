"""catalog frame and glazing types

Adds the second and third v1 catalogs (Window-Frame Elements, Window-Glazing)
mirroring the catalog_materials identity-plus-versions shape from
20260514_0007.

Revision ID: 20260514_0009
Revises: 20260514_0008
Create Date: 2026-05-14 14:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260514_0009"
down_revision: str | None = "20260514_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    _create_catalog(
        identity_table="catalog_frame_types",
        versions_table="catalog_frame_type_versions",
        current_version_fk_name="fk_catalog_frame_types_current_version",
        active_name_index="ix_catalog_frame_types_active_name",
        versions_record_index="ix_catalog_frame_type_versions_record",
        value_columns=[
            sa.Column("manufacturer", sa.Text(), nullable=True),
            sa.Column("brand", sa.Text(), nullable=True),
            sa.Column("width_mm", sa.Float(), nullable=True),
            sa.Column("u_value_w_m2k", sa.Float(), nullable=True),
            sa.Column("psi_g_w_mk", sa.Float(), nullable=True),
            sa.Column("psi_install_w_mk", sa.Float(), nullable=True),
        ],
    )
    _create_catalog(
        identity_table="catalog_glazing_types",
        versions_table="catalog_glazing_type_versions",
        current_version_fk_name="fk_catalog_glazing_types_current_version",
        active_name_index="ix_catalog_glazing_types_active_name",
        versions_record_index="ix_catalog_glazing_type_versions_record",
        value_columns=[
            sa.Column("manufacturer", sa.Text(), nullable=True),
            sa.Column("brand", sa.Text(), nullable=True),
            sa.Column("u_value_w_m2k", sa.Float(), nullable=True),
            sa.Column("g_value", sa.Float(), nullable=True),
        ],
    )


def downgrade() -> None:
    _drop_catalog(
        identity_table="catalog_glazing_types",
        versions_table="catalog_glazing_type_versions",
        current_version_fk_name="fk_catalog_glazing_types_current_version",
        active_name_index="ix_catalog_glazing_types_active_name",
        versions_record_index="ix_catalog_glazing_type_versions_record",
    )
    _drop_catalog(
        identity_table="catalog_frame_types",
        versions_table="catalog_frame_type_versions",
        current_version_fk_name="fk_catalog_frame_types_current_version",
        active_name_index="ix_catalog_frame_types_active_name",
        versions_record_index="ix_catalog_frame_type_versions_record",
    )


def _create_catalog(
    *,
    identity_table: str,
    versions_table: str,
    current_version_fk_name: str,
    active_name_index: str,
    versions_record_index: str,
    value_columns: list,
) -> None:
    # Identity row. ``current_version_id`` is created without an FK and the
    # constraint is added after the versions table exists to avoid the
    # circular reference at create time (matches catalog_materials in 0007).
    op.create_table(
        identity_table,
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
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
        versions_table,
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("record_id", sa.Text(), nullable=False),
        sa.Column("version_label", sa.Text(), nullable=False),
        sa.Column("version_date", sa.Date(), nullable=False),
        sa.Column("catalog_schema_version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        *value_columns,
        sa.Column("argb_color", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("source_provenance", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["record_id"], [f"{identity_table}.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_foreign_key(
        current_version_fk_name,
        identity_table,
        versions_table,
        ["current_version_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        active_name_index,
        identity_table,
        ["name"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        versions_record_index,
        versions_table,
        ["record_id", "created_at"],
    )


def _drop_catalog(
    *,
    identity_table: str,
    versions_table: str,
    current_version_fk_name: str,
    active_name_index: str,
    versions_record_index: str,
) -> None:
    op.drop_index(versions_record_index, table_name=versions_table)
    op.drop_index(active_name_index, table_name=identity_table)
    op.drop_constraint(current_version_fk_name, identity_table, type_="foreignkey")
    op.drop_table(versions_table)
    op.drop_table(identity_table)
