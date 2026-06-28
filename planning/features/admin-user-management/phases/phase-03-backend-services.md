---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Complete
AUTHOR: Codex (for Ed May)
SCOPE: Backend MVP services for invite, reset link, deactivate/reactivate, grants, and audit.
RELATED:
  - ../PRD.md
  - backend/features/auth/service.py
  - backend/features/auth/repository.py
  - backend/features/access/
  - backend/features/mcp/
---

# Phase 03 - Backend Services

## Goal

Implement the backend workflow rules behind MVP account lifecycle operations
before exposing HTTP routes.

## Implementation Tasks

1. Token service:
   - generate high-entropy invite/reset tokens;
   - store keyed hashes only;
   - revoke-and-replace duplicate active tokens;
   - consume tokens atomically with `FOR UPDATE`;
   - use constant-time token-hash comparison where applicable;
   - return raw links only to the immediate caller, never from persisted state.
2. User listing service:
   - list users with `active`, `invited`, `inactive`;
   - include role preset and recent admin action timestamp if cheap without
     exposing secrets/session ids.
3. Invite service:
   - create or reactivate users;
   - assign initial `admin.users.manage` capability when requested;
   - create invite token/link for manual delivery.
4. Reset-link service:
   - admin-triggered reset-link generation with audit;
   - reset completion hashes password with the existing Argon2id path;
   - invalidate active sessions and attributable MCP tokens.
5. Deactivate/reactivate service:
   - deactivate sets `deleted_at`, revokes sessions, account tokens, and MCP
     tokens;
   - reactivate clears `deleted_at` and issues a reset/invite link;
   - never silently restores sessions/tokens.
6. Grant service:
   - grant/revoke `admin.users.manage`;
   - enforce last-admin protection transactionally;
   - keep `catalog.edit` / `is_staff` out of MVP.
7. Audit service:
   - centralize admin action logging;
   - scrub tokens/passwords;
   - include actor, target, IP, user-agent, and before/after details.

## Verification

- Focused backend service tests for expired, consumed, revoked, wrong-type, and
  reused tokens.
- Last-admin race tests or a transaction-level proof using row/advisory locks.
- Session/MCP revocation tests after reset and deactivate.
- Audit rows inspected in tests.
- `make ci` at phase close.

## Exit Criteria

- MVP lifecycle rules work at service/repository level without HTTP routes.
- Sensitive mutations are atomic and audited.
- No raw token or password appears in stored rows, audit rows, or logs.

## Outcome (2026-06-27)

New `features/admin/` package (service + repository + models + audit; a
`routes.py` router stub holds the boundary until Phase 04) plus the public
completion path in `features/auth/`:

- **Token service** — built in Phase 02 (`account_token_service.issue_account_
  token`, revoke-and-replace). Phase 03 adds the redeem side in
  `features/auth/account_completion.py`: `complete_invite` / `complete_reset`
  validate the token under a row lock (unknown/wrong-type/consumed/revoked/
  expired all return one generic 400), set the password via the Argon2id path,
  consume the token, and revoke remaining account tokens + sessions + MCP tokens.
- **User listing** — `repository.list_user_rows` derives `active`/`invited`/
  `inactive` (from `deleted_at` + `password_set_at`), the `user`/`admin` role,
  active-invite flag, and last admin-action timestamp in one query.
- **Invite / reset-link / deactivate / reactivate / grant** services in
  `features/admin/service.py`, each one transaction: mutate, audit, return the
  refreshed row. Deactivate revokes sessions + account tokens + MCP tokens;
  reactivate issues a fresh invite-or-reset link.
- **Last-admin protection** — `repository.lock_active_admin_user_ids` locks the
  active admin-grant rows `FOR UPDATE OF g`, so concurrent
  deactivate/demote calls serialize and cannot race to zero admins. Deactivating
  or demoting the only active admin returns 409 `last_admin`.
- **Audit** — `features/admin/audit.py` centralizes admin-action logging with a
  `scrub_details` backstop that drops any `token`/`password`/`secret`/`link`/
  `hash` key. Self-service completion writes its own
  `password_reset_completed` / `account_invite_completed` rows.
- **Reuse** — idempotent grant centralized as
  `access_repository.ensure_global_grant` (used by the admin service and the
  bootstrap command); `has_usable_password` shared with the login/bootstrap path.
- Tests: `backend/tests/test_admin_service.py` (15) — invite/complete/sign-in,
  reset link + session invalidation, inactive-user reject, reused/wrong-type
  token reject, deactivate revokes sessions+MCP, deactivated-user-cannot-sign-in,
  reactivate link, grant/revoke, and three last-admin cases.
