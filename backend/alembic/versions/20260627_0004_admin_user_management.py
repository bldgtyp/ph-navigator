"""admin user management: account tokens, invited users, audit targets

Phase 02 of the admin-user-management MVP
(planning/features/admin-user-management). Adds the durable primitives the
invite / reset-link / deactivate / admin-grant lifecycle builds on:

- ``users.password_hash`` becomes nullable and a ``password_set_at`` column is
  added so an *invited* user can exist before they have ever chosen a password.
  ``authenticate()`` treats a row with no ``password_hash``/``password_set_at``
  as not authenticatable, so a pending invite cannot sign in.
- ``account_tokens`` holds single-use, expiring, **hashed** invite and
  password-reset tokens. Raw tokens are never stored; only a keyed hash is. A
  partial unique index enforces at most one active token per (user, type), which
  makes the revoke-and-replace policy safe by construction.
- ``user_action_log`` gains ``target_user_id`` / ``target_email`` so admin
  lifecycle actions (acting admin -> target user) are queryable per target
  without unindexed JSONB scans.

Revision ID: 20260627_0004
Revises: 20260627_0003
Create Date: 2026-06-27 20:45:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "20260627_0004"
down_revision: str | None = "20260627_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UPGRADE_SQL: tuple[str, ...] = (
    # Invited users have no usable password until they complete an invite/reset.
    "ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL",
    "ALTER TABLE public.users ADD COLUMN password_set_at timestamp with time zone",
    # Backfill existing accounts: anything that already has a password_hash has,
    # by definition, set a password at some prior point. created_at is the best
    # lower-bound timestamp we have.
    "UPDATE public.users SET password_set_at = created_at WHERE password_hash IS NOT NULL",
    # Per-target audit columns for the admin lifecycle (acting admin -> target).
    "ALTER TABLE public.user_action_log ADD COLUMN target_user_id uuid",
    "ALTER TABLE public.user_action_log ADD COLUMN target_email text",
    """
    ALTER TABLE ONLY public.user_action_log
        ADD CONSTRAINT fk_user_action_log_target_user
        FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE SET NULL
    """,
    "CREATE INDEX ix_user_action_log_target_created ON public.user_action_log (target_user_id, created_at)",
    # Single-use, expiring, hashed invite/reset tokens.
    """
    CREATE TABLE public.account_tokens (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        user_id uuid NOT NULL,
        token_type text NOT NULL,
        token_hash text NOT NULL,
        created_by uuid,
        created_at timestamp with time zone DEFAULT now() NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        consumed_at timestamp with time zone,
        revoked_at timestamp with time zone,
        request_ip text,
        request_user_agent text,
        CONSTRAINT pk_account_tokens PRIMARY KEY (id),
        CONSTRAINT uq_account_tokens_token_hash UNIQUE (token_hash),
        CONSTRAINT ck_account_tokens_type_allowed
            CHECK (token_type = ANY (ARRAY['invite'::text, 'password_reset'::text])),
        CONSTRAINT fk_account_tokens_user
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
        CONSTRAINT fk_account_tokens_created_by
            FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL
    )
    """,
    # At most one active (unconsumed, unrevoked) token per user+type: the
    # revoke-and-replace policy is enforced by the schema, not just the service.
    """
    CREATE UNIQUE INDEX uq_account_tokens_active
        ON public.account_tokens (user_id, token_type)
        WHERE consumed_at IS NULL AND revoked_at IS NULL
    """,
    # Supports the "find this user's active token" lookup and expired-token sweeps.
    """
    CREATE INDEX ix_account_tokens_active_expiry
        ON public.account_tokens (expires_at)
        WHERE consumed_at IS NULL AND revoked_at IS NULL
    """,
)

_DOWNGRADE_SQL: tuple[str, ...] = (
    "DROP TABLE IF EXISTS public.account_tokens",
    "DROP INDEX IF EXISTS public.ix_user_action_log_target_created",
    "ALTER TABLE public.user_action_log DROP CONSTRAINT IF EXISTS fk_user_action_log_target_user",
    "ALTER TABLE public.user_action_log DROP COLUMN IF EXISTS target_email",
    "ALTER TABLE public.user_action_log DROP COLUMN IF EXISTS target_user_id",
    "ALTER TABLE public.users DROP COLUMN IF EXISTS password_set_at",
    # Re-imposing NOT NULL fails if any invited (password-less) user rows exist;
    # that is the intended signal that those rows must be resolved before a
    # downgrade rather than silently dropping the invariant.
    "ALTER TABLE public.users ALTER COLUMN password_hash SET NOT NULL",
)


def upgrade() -> None:
    for statement in _UPGRADE_SQL:
        op.execute(statement)


def downgrade() -> None:
    for statement in _DOWNGRADE_SQL:
        op.execute(statement)
