"""allow user-scoped MCP tokens

Revision ID: 20260801_0012
Revises: 20260729_0011
Create Date: 2026-08-01 11:00:00.000000

A null ``project_id`` distinguishes a user-scoped token from the existing
project-scoped token. Both principal types retain the same hash, scope,
expiry, revocation, and issuing-user fields.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260801_0012"
down_revision: str | None = "20260729_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE mcp_tokens ALTER COLUMN project_id DROP NOT NULL")
    op.execute(
        """
        CREATE INDEX ix_mcp_tokens_user_active
        ON mcp_tokens (issued_by_user_id, created_at DESC)
        WHERE project_id IS NULL
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM mcp_tokens WHERE project_id IS NULL")
    op.execute("DROP INDEX IF EXISTS ix_mcp_tokens_user_active")
    op.execute("ALTER TABLE mcp_tokens ALTER COLUMN project_id SET NOT NULL")
