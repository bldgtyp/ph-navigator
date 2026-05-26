"""project assets and jobs

Revision ID: 20260526_0011
Revises: 20260524_0010
Create Date: 2026-05-26 09:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260526_0011"
down_revision: str | None = "20260524_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_assets",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("asset_kind", sa.Text(), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False, unique=True),
        sa.Column("original_filename", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("content_hash_sha256", sa.Text(), nullable=False),
        sa.Column("r2_etag", sa.Text()),
        sa.Column("upload_status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("uploaded_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_by", sa.Uuid()),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["deleted_by"], ["users.id"]),
        sa.CheckConstraint(
            "asset_kind IN ('datasheet', 'site_photo', 'hbjson', 'simulation_file', 'export_bundle', 'other')",
            name="project_assets_kind_allowed",
        ),
        sa.CheckConstraint(
            "upload_status IN ('pending', 'uploaded', 'failed')",
            name="project_assets_status_allowed",
        ),
        sa.CheckConstraint("size_bytes >= 0", name="project_assets_size_nonnegative"),
    )
    op.create_index(
        "ix_project_assets_project_kind",
        "project_assets",
        ["project_id", "asset_kind"],
        postgresql_where=sa.text("deleted_at IS NULL AND upload_status = 'uploaded'"),
    )
    op.create_index(
        "ix_project_assets_content_hash",
        "project_assets",
        ["project_id", "content_hash_sha256"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "project_jobs",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("job_type", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
        sa.Column("result_asset_id", sa.Text()),
        sa.Column("error_code", sa.Text()),
        sa.Column("error_details", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["result_asset_id"], ["project_assets.id"]),
        sa.CheckConstraint("job_type IN ('asset_bulk_download')", name="project_jobs_type_allowed"),
        sa.CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'failed')",
            name="project_jobs_status_allowed",
        ),
        sa.CheckConstraint("progress >= 0 AND progress <= 100", name="project_jobs_progress_bounded"),
    )
    op.create_index("ix_project_jobs_project_status", "project_jobs", ["project_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_project_jobs_project_status", table_name="project_jobs")
    op.drop_table("project_jobs")
    op.drop_index("ix_project_assets_content_hash", table_name="project_assets")
    op.drop_index("ix_project_assets_project_kind", table_name="project_assets")
    op.drop_table("project_assets")
