"""access capability model: schema foundation

Phase 1 of the access-capability-model refactor
(planning/archive/dated/2026-06-27/access-capability-model). Lays down the additive,
behavior-neutral schema the capability resolver builds on:

- ``projects.team_id``  — nullable, no FK yet. The ``teams`` table is held
  (authored as documented DDL, applied when multi-tenancy lands); the
  foreign-key constraint is added then. Until then a project with a NULL
  ``team_id`` is treated as a legacy/bldgtyp-internal project.
- ``users.is_staff``    — bldgtyp cross-tenant flag; default false so every
  existing user keeps today's behavior.
- ``user_grants``       — fine-grained per-user capability grants (PRD §5.2).
  Its first consumer is the catalog-admin grant (``catalog.edit``); the table
  generalizes to any future scoped permission without new tables.

Nothing reads the new columns yet, so applying this migration changes no
observable behavior. The held tenancy/share DDL lives next to the migrations
in ``alembic/held/phase5_tenancy_and_shares.sql``.

Revision ID: 20260627_0003
Revises: 20260627_0002
Create Date: 2026-06-27 16:30:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260627_0003"
down_revision: str | None = "20260627_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UPGRADE_SQL: tuple[str, ...] = (
    "ALTER TABLE public.projects ADD COLUMN team_id uuid",
    "ALTER TABLE public.users ADD COLUMN is_staff boolean NOT NULL DEFAULT false",
    """
    CREATE TABLE public.user_grants (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        user_id uuid NOT NULL,
        capability text NOT NULL,
        scope_type text NOT NULL,
        scope_id uuid,
        granted_by uuid,
        granted_at timestamp with time zone DEFAULT now() NOT NULL,
        revoked_at timestamp with time zone,
        CONSTRAINT pk_user_grants PRIMARY KEY (id),
        CONSTRAINT ck_user_grants_scope_type_allowed
            CHECK (scope_type = ANY (ARRAY['global'::text, 'team'::text, 'project'::text])),
        CONSTRAINT ck_user_grants_global_scope_is_unscoped
            CHECK ((scope_type = 'global') = (scope_id IS NULL)),
        CONSTRAINT fk_user_grants_user
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_grants_granted_by
            FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL
    )
    """,
    # ``NULLS NOT DISTINCT`` (Postgres 15+) makes two global grants of the same
    # capability collide on their NULL ``scope_id``, which a plain unique index
    # would treat as distinct.
    """
    CREATE UNIQUE INDEX uq_user_grants_active
        ON public.user_grants (user_id, capability, scope_type, scope_id)
        NULLS NOT DISTINCT
        WHERE revoked_at IS NULL
    """,
)

_DOWNGRADE_SQL: tuple[str, ...] = (
    "DROP TABLE IF EXISTS public.user_grants",
    "ALTER TABLE public.users DROP COLUMN IF EXISTS is_staff",
    "ALTER TABLE public.projects DROP COLUMN IF EXISTS team_id",
)


def upgrade() -> None:
    for statement in _UPGRADE_SQL:
        op.execute(statement)


def downgrade() -> None:
    for statement in _DOWNGRADE_SQL:
        op.execute(statement)
