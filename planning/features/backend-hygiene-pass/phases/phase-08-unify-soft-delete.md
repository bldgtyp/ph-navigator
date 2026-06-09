---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Implemented — shipped in #13 (commit 51dcd77).
AUTHOR: Claude (Opus 4.7)
SCOPE: Phase 8 — migrate `users.is_active` (bool) to `users.deleted_at`
       (timestamptz), matching every other soft-deleted table.
EFFORT: ~1–2 h
BUCKET: Soon
DEPENDS_ON: none (last in the sequence because it touches auth)
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md` §2.1
  - `backend/alembic/versions/20260512_0002_users_and_sessions.py`
  - `backend/features/auth/repository.py`
  - `backend/features/auth/service.py`
---

# Phase 8 — Unify `users` soft-delete dialect

## Goal

Replace `users.is_active boolean` with `users.deleted_at
timestamptz`. After this phase, every soft-deletable table in the
schema uses the same `WHERE deleted_at IS NULL` clause.

## Background

Review §2.1: the codebase carries two soft-delete dialects.
`users` (migration 0002) uses `is_active`; everything else uses
`deleted_at timestamptz`. Repository code has to learn both patterns,
and any future "join across" query has to remember which clause
applies where.

Backfill is mechanical:

```sql
deleted_at = CASE WHEN is_active THEN NULL ELSE now() END
```

## Pre-work

1. Read `backend/alembic/versions/20260512_0002_users_and_sessions.py`
   for the current `users` schema and especially:
   - The `is_active` column definition (nullability, default).
   - The `uq_users_email_lower` partial unique index — is it
     `WHERE is_active = true` or already `WHERE deleted_at IS NULL`?
     The review mentioned `WHERE deleted_at IS NULL` in §"What the
     schema gets right", but that may refer to *sessions*, not users.
     Verify before writing the migration. If the index filters on
     `is_active`, it must be rebuilt to filter on `deleted_at IS NULL`
     in the same migration.
2. Grep for every reader of `is_active`:

   ```bash
   grep -rn "is_active" backend/features/ backend/tests/
   ```

   Expected: `auth/repository.py`, `auth/service.py`, possibly
   `projects/access.py` (owner lookups), MCP `_token_user_or_error`,
   and a handful of tests.

3. List the auth flows that touch the column today, especially the
   "user disabled" path — confirm the user-visible error code stays
   the same after migration.

## Steps

1. **Migration**: generate
   `0022_users_deleted_at.py` (number it next in sequence after
   Phase 5's potential 0021).

   ```python
   def upgrade() -> None:
       op.add_column(
           "users",
           sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
       )
       op.execute(
           "UPDATE users SET deleted_at = now() WHERE is_active = false"
       )
       # Rebuild the email-lower unique index on the new column if it
       # currently filters on is_active.
       op.drop_index("uq_users_email_lower", "users")
       op.create_index(
           "uq_users_email_lower",
           "users",
           [sa.text("lower(email)")],
           unique=True,
           postgresql_where=sa.text("deleted_at IS NULL"),
       )
       op.drop_column("users", "is_active")

   def downgrade() -> None:
       op.add_column(
           "users",
           sa.Column("is_active", sa.Boolean(), nullable=False,
                     server_default=sa.text("true")),
       )
       op.execute(
           "UPDATE users SET is_active = (deleted_at IS NULL)"
       )
       op.alter_column("users", "is_active", server_default=None)
       op.drop_index("uq_users_email_lower", "users")
       op.create_index(
           "uq_users_email_lower",
           "users",
           [sa.text("lower(email)")],
           unique=True,
           postgresql_where=sa.text("is_active = true"),
       )
       op.drop_column("users", "deleted_at")
   ```

   Verify the exact index name and predicate by reading 0002 before
   committing this.

2. **Repository update**: change every `WHERE is_active = true` in
   `auth/repository.py` (and any other repo that reads users) to
   `WHERE deleted_at IS NULL`. Rename any internal column reference.

3. **Service update**: the "user disabled" error path in
   `auth/service.py::authenticate` becomes "user soft-deleted" — same
   `api_error` code, same HTTP status, just a different SQL clause
   underneath. Confirm the error code is unchanged. If `is_active`
   appears in any Pydantic model returned to the client, decide:
   either drop it (preferred) or compute it as
   `deleted_at is None` for the duration of one deprecation window.

4. **MCP token check**: `mcp/tools/_helpers.py::_token_user_or_error`
   (after Phase 7) or `mcp/tools.py::_token_user_or_error` (before)
   likely checks `is_active`. Update.

5. **Tests**: update fixtures / factories that set `is_active`. Add
   a test that confirms a soft-deleted user cannot authenticate and
   that the API returns the existing "disabled" error.

6. **Run**:

   ```bash
   cd backend && uv run alembic upgrade head
   cd backend && uv run alembic downgrade -1
   cd backend && uv run alembic upgrade head
   cd backend && uv run pytest tests/features/auth -q
   ```

7. **Playwright sanity**: sign in as `codex@example.com` via the MCP
   browser to confirm no regression in the real sign-in path. See
   `CLAUDE.md` "Live UI access for agents".

8. `make ci`.

## Files touched

- New migration `backend/alembic/versions/2026XXXX_0022_users_deleted_at.py`
- `backend/features/auth/repository.py`
- `backend/features/auth/service.py`
- `backend/features/auth/models.py` (if `is_active` was exposed)
- `backend/features/mcp/tools/_helpers.py` (or `tools.py` pre-Phase 7)
- Any other repo or service that reads `is_active`
- Tests under `backend/tests/features/auth/` and any fixture file

## Verification

- `grep -rn "is_active" backend/` returns nothing after the change.
- Migration round-trips cleanly.
- Auth tests pass; sign-in works end-to-end via Playwright.
- `make ci` green.
- `pg_constraint` / `pg_indexes` confirm the rebuilt
  `uq_users_email_lower` partial index is on `deleted_at IS NULL`.

## Risks

- **Live session invalidation**: if any session record references the
  user by a derived value that includes `is_active`, dropping the
  column could break in-flight sessions. Sessions on this codebase
  reference users by FK; this is unlikely to be an issue, but verify
  by reading `auth/repository.py` first.
- **Frontend dependence**: a `UserPublic`-shaped model returned to the
  client may include `is_active`. If so, the frontend should be
  updated in the same PR or the field should remain (computed) for one
  release before being dropped. Grep `frontend/src/` for `is_active`.
- **Single-active-session rule** (per `CLAUDE.md`): do not sign in as
  `ed@example.com` while testing this phase or you'll invalidate
  Ed's browser session. Use `codex@example.com`.

## Done when

- `is_active` is gone from schema and code, every reader uses
  `deleted_at IS NULL`, auth flows work end-to-end, CI green,
  `STATUS.md` updated.
