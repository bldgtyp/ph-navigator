---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Complete
AUTHOR: Codex (for Ed May)
SCOPE: Account lifecycle schema, token storage, audit shape, and first-admin bootstrap.
RELATED:
  - ../PRD.md
  - ../PLAN.md
  - backend/alembic/versions/
  - backend/features/auth/models.py
  - backend/features/access/capabilities.py
---

# Phase 02 - Schema / Bootstrap

## Goal

Add the durable database primitives needed for MVP invite/reset-link/admin
lifecycle without placeholder passwords or unaudited production setup paths.

## Implementation Tasks

1. User state:
   - allow invited users without an authenticatable password, preferably by
     making `users.password_hash` nullable;
   - add `users.password_set_at timestamptz`;
   - keep `deleted_at` for inactive/deactivated users;
   - ensure `authenticate()` rejects users without `password_hash` or
     `password_set_at`.
2. Account tokens:
   - add `account_tokens` with `token_type`, keyed `token_hash`, `expires_at`,
     `consumed_at`, `revoked_at`, `created_by`, IP, and user-agent metadata;
   - add indexes for active lookup and cleanup;
   - support invite and password-reset tokens in one table unless lifecycles
     diverge.
3. Audit shape:
   - decide whether to add `target_user_id` / `target_email` columns to
     `user_action_log`;
   - add indexes needed by MVP per-user audit lookup or SQL fallback.
4. Capability namespace:
   - add `ADMIN_USERS_MANAGE = "admin.users.manage"`;
   - keep `CATALOG_EDIT = "catalog.edit"` separate and out of the MVP UI.
5. MCP token revocation:
   - add repository helper to revoke all active `mcp_tokens` issued by a user.
6. Production bootstrap command:
   - create a guarded operator command that can create/repair the first admin;
   - require explicit production confirmation;
   - issue an invite/reset link;
   - write audit rows;
   - never set/print a reusable temporary password.

## Verification

- Alembic upgrade/downgrade or project-standard migration checks.
- Backend tests:
  - pending invited user cannot authenticate;
  - token hash stored, raw token absent from DB/audit/logs;
  - bootstrap grants only the intended admin capability;
  - MCP user-token revocation helper affects only the target user's active tokens.
- `make ci` at phase close.

## Exit Criteria

- Schema supports `active`, `invited`, and `inactive` states.
- First production admin can be bootstrapped without a temporary password.
- Later MVP phases can build services without more schema churn.

## Outcome (2026-06-27)

Migration `20260627_0004_admin_user_management.py` (applies + downgrades; head
is `20260627_0004`):

- `users.password_hash` is now nullable + `users.password_set_at` added.
  `authenticate()` rejects rows without a usable password via the shared
  `has_usable_password()` predicate (reused by the bootstrap command), so a
  pending invite cannot sign in. `active`/`invited`/`inactive` derive from
  `deleted_at` + `password_set_at` + active-token state.
- `account_tokens` table: single-use, expiring, **keyed-hash-only** invite /
  password_reset tokens. `uq_account_tokens_active` partial-unique index makes
  revoke-and-replace safe by construction; `ix_account_tokens_active_expiry`
  supports active lookup + expired-token sweeps. `token_hash` is globally unique.
- `user_action_log` gains `target_user_id` (FK) + `target_email` and
  `ix_user_action_log_target_created` for per-target admin history.
- Capability `ADMIN_USERS_MANAGE = "admin.users.manage"` added (grantable).
  It remains the only stored Admin grant; the resolver derives `catalog.edit`
  from the Admin preset for catalog maintenance.
- `mcp_repository.revoke_tokens_for_user()` revokes every active token a user
  issued, across projects (only that user's).
- Token primitives split for reuse by Phase 03: `features/auth/account_tokens.py`
  (crypto + fragment links), `features/auth/account_token_service.py`
  (`issue_account_token` = revoke-and-replace + mint), repository storage funcs.
- `scripts/bootstrap_admin.py`: production-capable (requires
  `--confirm-production`), audited first-admin/break-glass command. Creates or
  repairs the admin (invited, no password), ensures the grant, issues a one-time
  invite (or reset for an existing-password admin) link printed once, never a
  reusable password.
- New settings: `account_invite_token_ttl_hours` (168), `account_reset_token_
  ttl_minutes` (30), `account_token_secret` (HMAC key, sync:false in prod),
  `frontend_base_url` (canonical link base, never request Host).
- Tests: `backend/tests/test_admin_account_schema.py` (10 cases) — invited user
  cannot authenticate; set-password enables login; token stores only the hash;
  revoke-and-replace; single-use consume; fragment links; per-user MCP revoke;
  bootstrap invite/reset/grant/audit + production guard.
