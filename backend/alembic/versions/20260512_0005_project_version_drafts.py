"""project version drafts

Revision ID: 20260512_0005
Revises: 20260512_0004
Create Date: 2026-05-12 18:45:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260512_0005"
down_revision: str | None = "20260512_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "project_version_drafts",
        sa.Column("version_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("body", postgresql.JSONB(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("base_version_etag", sa.Text(), nullable=False),
        sa.Column("draft_etag", sa.Text(), nullable=False),
        sa.Column("last_patched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_via", sa.Text(), nullable=False, server_default=sa.text("'browser'")),
        sa.CheckConstraint("updated_via IN ('browser', 'mcp')", name="project_version_drafts_updated_via_allowed"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["version_id"], ["project_versions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("version_id", "user_id"),
    )
    op.create_index(
        "ix_project_version_drafts_last_patched",
        "project_version_drafts",
        ["last_patched_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_project_version_drafts_last_patched", table_name="project_version_drafts")
    op.drop_table("project_version_drafts")
