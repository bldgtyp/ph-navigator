"""user table views

Persistence store for per-user, per-(project, table) DataTable ViewState.
One row per (user_id, project_id, table_key); deletion = reset.

This table intentionally has NO ``deleted_at`` column — unlike every
other soft-deletable table in the schema, ``user_table_views`` rows are
hard-deleted by ``features.table_views.repository.delete``. The row is
a UI-state cache (column widths, filters, etc.) that fully regenerates
on the next save; there is no audit or recovery value in keeping a
tombstone. Confirmed as the canonical choice in the 2026-06-09
hygiene pass; see ``planning/features/backend-hygiene-pass/decisions.md``.

Revision ID: 20260524_0010
Revises: 20260514_0009
Create Date: 2026-05-24 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260524_0010"
down_revision: str | None = "20260514_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_table_views",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("table_key", sa.Text(), nullable=False),
        sa.Column(
            "view_state_schema_version",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column("view_state", postgresql.JSONB(), nullable=False),
        sa.Column("view_state_size_bytes", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "view_state_schema_version = 1",
            name="user_table_views_schema_version_supported",
        ),
        sa.CheckConstraint(
            "view_state_size_bytes <= 65536",
            name="user_table_views_size_bounded",
        ),
        sa.CheckConstraint(
            "table_key ~ '^[a-z][a-z0-9_]*$'",
            name="user_table_views_table_key_syntax",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "project_id", "table_key"),
    )
    op.create_index(
        "idx_user_table_views_project_lookup",
        "user_table_views",
        ["project_id", "table_key"],
    )


def downgrade() -> None:
    op.drop_index("idx_user_table_views_project_lookup", table_name="user_table_views")
    op.drop_table("user_table_views")
