---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Backend services for invite, reset, deactivate/reactivate, grants, and audit.
RELATED:
  - ../PRD.md
  - backend/features/auth/service.py
  - backend/features/auth/repository.py
  - backend/features/access/
  - backend/features/mcp/
---

# Phase 03 - Backend Services

## Goal

Implement the backend workflow rules behind account lifecycle operations before
exposing HTTP routes.

## Implementation Tasks

1. Token service:
   - generate high-entropy invite/reset tokens;
   - store keyed hashes only;
   - revoke-and-replace duplicate active tokens;
   - consume tokens atomically with `FOR UPDATE`;
   - use constant-time token-hash comparison where applicable.
2. User listing service:
   - list users with `active`, `invited`, `inactive`;
   - include role preset, `is_staff`, active session count, last login, and
     recent admin action timestamp without exposing secrets/session ids.
3. Invite service:
   - create or reactivate users;
   - assign initial capabilities after validation;
   - create invite token;
   - enqueue/send invite email through the Phase 05 mailer abstraction.
4. Reset service:
   - self-service reset request with generic response;
   - admin-triggered reset request with audit;
   - reset completion hashes password with the existing Argon2id path;
   - invalidate active sessions and attributable MCP tokens.
5. Deactivate/reactivate service:
   - deactivate sets `deleted_at`, revokes sessions, account tokens, and MCP
     tokens;
   - reactivate clears `deleted_at` and sends a reset/invite link;
   - never silently restores sessions/tokens.
6. Grant service:
   - grant/revoke `admin.users.manage`;
   - grant/revoke `catalog.edit` if in first-pass scope;
   - toggle `is_staff` only with fresh admin re-auth;
   - enforce last-admin protection transactionally.
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

- All lifecycle rules work at service/repository level without HTTP routes.
- Sensitive mutations are atomic and audited.
- No raw token or password appears in stored rows or logs.
