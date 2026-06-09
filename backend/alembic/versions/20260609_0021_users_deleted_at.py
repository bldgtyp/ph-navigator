"""users deleted at

Migrates ``users.is_active boolean`` to ``users.deleted_at timestamptz``,
matching every other soft-deletable table in the schema. After this
migration, every "list non-deleted X" query uses the same
``WHERE deleted_at IS NULL`` clause.

Backfill: rows with ``is_active = false`` get ``deleted_at = now()`` so
the existing behavior (inactive users cannot authenticate) is
preserved. The unique index ``uq_users_email_lower`` does not filter
on ``is_active`` today, so it does not need to be rebuilt.

Revision ID: 20260609_0021
Revises: 20260609_0020
Create Date: 2026-06-09 16:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260609_0021"
down_revision: str | None = "20260609_0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE users SET deleted_at = now() WHERE is_active = false")
    op.drop_column("users", "is_active")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.execute("UPDATE users SET is_active = (deleted_at IS NULL)")
    op.alter_column("users", "is_active", server_default=None)
    op.drop_column("users", "deleted_at")
