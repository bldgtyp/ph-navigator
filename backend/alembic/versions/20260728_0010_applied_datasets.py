"""add applied licensed dataset audit rows

Revision ID: 20260728_0010
Revises: 20260726_0009
Create Date: 2026-07-28 21:05:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260728_0010"
down_revision: str | None = "20260726_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE public.applied_datasets (
            slug text NOT NULL,
            version text NOT NULL,
            sha256 text NOT NULL,
            applied_at timestamptz DEFAULT now() NOT NULL,
            applied_by text NOT NULL,
            CONSTRAINT uq_applied_datasets_slug_version UNIQUE (slug, version),
            CONSTRAINT ck_applied_datasets_version CHECK (version ~ '^[1-9][0-9]*$'),
            CONSTRAINT ck_applied_datasets_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$')
        )
        """
    )
    op.execute(
        """
        CREATE INDEX ix_applied_datasets_slug_applied_at
        ON public.applied_datasets (slug, applied_at DESC)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.applied_datasets")
