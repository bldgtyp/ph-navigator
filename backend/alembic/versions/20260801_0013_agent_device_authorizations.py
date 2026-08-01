"""add agent device authorizations

Revision ID: 20260801_0013
Revises: 20260801_0012
Create Date: 2026-08-01 12:30:00.000000

Short-lived, hashed device grants bridge an unauthenticated agent process to
an authenticated browser approval. Redeeming a grant creates a normal
user-scoped ``mcp_tokens`` row; plaintext credentials are never persisted.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260801_0013"
down_revision: str | None = "20260801_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE mcp_device_authorizations (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            device_code_hash text NOT NULL,
            user_code varchar(9) NOT NULL,
            label text NOT NULL,
            scopes text[] NOT NULL,
            status text NOT NULL DEFAULT 'pending',
            approving_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
            token_id uuid REFERENCES mcp_tokens(id) ON DELETE SET NULL,
            poll_interval_seconds integer NOT NULL DEFAULT 5,
            created_at timestamptz NOT NULL DEFAULT now(),
            expires_at timestamptz NOT NULL,
            last_polled_at timestamptz,
            decided_at timestamptz,
            redeemed_at timestamptz,
            CONSTRAINT ck_mcp_device_authorizations_scopes_allowed
                CHECK (scopes <@ ARRAY[
                    'project:read'::text, 'project:write'::text,
                    'asset:read'::text, 'asset:write'::text
                ]),
            CONSTRAINT ck_mcp_device_authorizations_scopes_nonempty
                CHECK (cardinality(scopes) > 0),
            CONSTRAINT ck_mcp_device_authorizations_status
                CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'redeemed')),
            CONSTRAINT ck_mcp_device_authorizations_poll_interval
                CHECK (poll_interval_seconds BETWEEN 1 AND 30),
            CONSTRAINT uq_mcp_device_authorizations_device_code_hash
                UNIQUE (device_code_hash),
            CONSTRAINT uq_mcp_device_authorizations_user_code
                UNIQUE (user_code)
        )
        """
    )
    op.execute(
        """
        CREATE INDEX ix_mcp_device_authorizations_expiry
        ON mcp_device_authorizations (expires_at)
        WHERE status IN ('pending', 'approved')
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS mcp_device_authorizations")
