"""Allow catalog-only desktop grants without rewriting existing rows.

Revision ID: 20260909_0014
Revises: 20260801_0013
Create Date: 2026-09-09

Downgrade revokes new-scope grants by deleting them before restoring the old
constraints. Existing grants without catalog:read survive unchanged.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260909_0014"
down_revision: str | None = "20260801_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _replace_constraints(*, catalog_read: bool) -> None:
    scopes = "'project:read'::text, 'project:write'::text, 'asset:read'::text, 'asset:write'::text"
    if catalog_read:
        scopes += ", 'catalog:read'::text"
    for table in ("mcp_tokens", "mcp_device_authorizations"):
        constraint = f"ck_{table}_scopes_allowed"
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT {constraint}")
        op.execute(f"ALTER TABLE {table} ADD CONSTRAINT {constraint} CHECK (scopes <@ ARRAY[{scopes}])")


def upgrade() -> None:
    _replace_constraints(catalog_read=True)


def downgrade() -> None:
    op.execute("DELETE FROM mcp_device_authorizations WHERE 'catalog:read' = ANY(scopes)")
    op.execute("DELETE FROM mcp_tokens WHERE 'catalog:read' = ANY(scopes)")
    _replace_constraints(catalog_read=False)
