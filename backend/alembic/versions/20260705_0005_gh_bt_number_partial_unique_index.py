"""bt_number partial-unique index (live rows only)

The baseline shipped a plain ``UNIQUE (bt_number)`` constraint, which keeps a
bt_number reserved forever — even after a project is soft-deleted. The
Grasshopper Data API keys projects by bt_number (`GET /api/v1/gh/projects/
{bt_number}`), so bt_number must stay unique *among live projects* while
freeing the value once a project is soft-deleted. Swap the full constraint for
a partial unique index on ``WHERE deleted_at IS NULL``.

The old constraint was strictly stronger than the new index (unique over all
rows ⊇ unique over live rows), so no existing data can violate the partial
index — the swap is a no-op on any conforming table.

Revision ID: 20260705_0005
Revises: 20260627_0004
Create Date: 2026-07-05 14:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260705_0005"
down_revision: str | None = "20260627_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE projects DROP CONSTRAINT IF EXISTS uq_projects_bt_number")
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_bt_number_live
        ON projects (bt_number)
        WHERE deleted_at IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_projects_bt_number_live")
    op.execute(
        """
        ALTER TABLE projects
        ADD CONSTRAINT uq_projects_bt_number UNIQUE (bt_number)
        """
    )
