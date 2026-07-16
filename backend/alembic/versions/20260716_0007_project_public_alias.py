"""project_public_alias: user-settable public-facing project title

Adds a nullable `public_alias` to `projects`. The internal `name` may carry
identifying info (client/family name); the alias is the title shown publicly.
Display resolution is `public_alias ?? name` (server-computed `display_name`),
and the alias — once set — also redacts the internal `name` from `client`
viewers. Behaviour-neutral until an alias is set. See
planning/features/project-public-alias/PRD.md.

Revision ID: 20260716_0007
Revises: 20260716_0006
Create Date: 2026-07-16 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260716_0007"
down_revision: str | None = "20260716_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE public.projects ADD COLUMN public_alias text")


def downgrade() -> None:
    op.execute("ALTER TABLE public.projects DROP COLUMN IF EXISTS public_alias")
