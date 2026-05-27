"""project lifecycle delete metadata

Revision ID: 20260526_0013
Revises: 20260526_0012
Create Date: 2026-05-26 19:45:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260526_0013"
down_revision: str | None = "20260526_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("deleted_by", sa.Uuid(), nullable=True))
    op.add_column("projects", sa.Column("hard_delete_after", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_projects_deleted_by",
        "projects",
        "users",
        ["deleted_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_projects_owner_deleted",
        "projects",
        ["owner_id", "deleted_at"],
        postgresql_where=sa.text("deleted_at IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_projects_owner_deleted", table_name="projects")
    op.drop_constraint("fk_projects_deleted_by", "projects", type_="foreignkey")
    op.drop_column("projects", "hard_delete_after")
    op.drop_column("projects", "deleted_by")
