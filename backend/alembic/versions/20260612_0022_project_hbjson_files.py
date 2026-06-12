"""project hbjson files

Revision ID: 20260612_0022
Revises: 20260609_0021
Create Date: 2026-06-12 09:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260612_0022"
down_revision: str | None = "20260609_0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_hbjson_files",
        sa.Column("id", sa.Uuid(), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("asset_id", sa.Text(), nullable=False, unique=True),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("uploaded_by", sa.Uuid(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        # Geometry summary cached at upload time (D-13: columns land in
        # Phase 1; the extraction job arrives in Phase 2; the consuming
        # feature — US-ENV-14 Airtightness — is FUTURE).
        sa.Column("extracted_volume_m3", sa.Double()),
        sa.Column("extracted_envelope_area_m2", sa.Double()),
        sa.Column("extracted_floor_area_m2", sa.Double()),
        sa.Column("extraction_status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("extraction_error", sa.Text()),
        sa.Column("extracted_at", sa.DateTime(timezone=True)),
        # Denormalized from project_assets at link time so the dedup
        # contract can be a DB constraint (a partial unique index can't
        # span a join).
        sa.Column("content_hash_sha256", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["asset_id"], ["project_assets.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.CheckConstraint(
            "extraction_status IN ('pending', 'success', 'failed')",
            name="project_hbjson_files_extraction_status_allowed",
        ),
    )
    op.create_index(
        "ix_project_hbjson_files_project_uploaded",
        "project_hbjson_files",
        ["project_id", sa.text("uploaded_at DESC")],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    # Race-proof backstop for the US-VIEW-1 crit. 3 content-hash dedup:
    # two editors linking the same bytes concurrently cannot both land.
    op.create_index(
        "ux_project_hbjson_files_project_hash",
        "project_hbjson_files",
        ["project_id", "content_hash_sha256"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ux_project_hbjson_files_project_hash", table_name="project_hbjson_files")
    op.drop_index("ix_project_hbjson_files_project_uploaded", table_name="project_hbjson_files")
    op.drop_table("project_hbjson_files")
