---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
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
