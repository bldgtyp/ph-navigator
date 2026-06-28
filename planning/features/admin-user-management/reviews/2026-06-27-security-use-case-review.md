---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Draft
AUTHOR: Codex (for Ed May)
SCOPE: Security and use-case review for the admin-user-management planning packet.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
  - ../research.md
  - ../../v2-production-rollout/PLAN.md
---

# Security / Use-Case Review - Admin User Management

## Findings

### P0 - Production rollout must depend on this feature

The existing production rollout plan allowed production account creation to
remain an explicit operator action for the initial Ed/John cutover. Ed has now
made admin-user-management a prerequisite. The rollout should be treated as
blocked after infrastructure rehearsal until invite/reset/revoke/admin-grant
flows are implemented and verified.

Required correction: production rollout Phase 1 should no longer seed Ed + John
with manually chosen passwords as the normal path. It should bootstrap only the
first admin through an audited one-time command, then use `/admin/users` for
John and all test users.

### P0 - Cookie-authenticated admin mutations need CSRF protection

The app uses `HttpOnly` session cookies and `credentials: "include"`. The
production rollout currently keeps `SameSite=None; Secure` for split-origin
`www.ph-nav.com` -> `api.ph-nav.com`, and current code has no CSRF middleware
or unsafe-method Origin gate.

Required correction: Phase 01 must either prove production works with
`SameSite=Lax` for `www.ph-nav.com` -> `api.ph-nav.com`, or add explicit CSRF
protection: trusted Origin validation plus an app-only custom header/token on
unsafe methods. Do not ship user-admin mutations on `SameSite=None` without this.

### P0 - Pending invites need real account state

Current `users.password_hash` is required. A secure invite flow cannot create a
pending user with an admin-visible or placeholder password.

Required correction: add account-state schema before invite implementation.
Preferred: nullable `password_hash`, `password_set_at`, and invite status derived
from `deleted_at`, `password_set_at`, and active invite token state.

### P1 - Admin re-auth should be settled as required

The prior plan left admin re-authentication open. Best practice for sensitive
account changes is a fresh-auth gate.

Required correction: require fresh admin re-auth for admin-triggered reset,
deactivate/reactivate, `admin.users.manage`, `catalog.edit`, and `is_staff`
changes. A `POST /api/v1/auth/reauth` route with a short fresh-auth window is
cleaner than passing the admin password to every mutation.

### P1 - Rate limiting needs a durable implementation

The plan mentioned rate limiting but not where it lives. Public reset is
internet-facing; process memory is too weak as the only control.

Required correction: implement a DB-backed limiter or equivalent platform
control for public reset and resend operations. At minimum rate-limit by
normalized email, IP, and action.

### P1 - Token hashing should be keyed

High-entropy reset/invite tokens can be stored as SHA-256 hashes, but a keyed
HMAC/pepper is a better default for DB-only compromise resistance and mirrors
the fact that these are account-recovery credentials.

Required correction: store only keyed token hashes, compare constant-time, and
never log raw token values.

### P1 - Last-admin guard must be race-safe

The plan already prevents last-admin lockout, but the check must be
transactional. Two admins demoting/deactivating each other at the same time
should not leave zero active admins.

Required correction: lock relevant user/grant rows or use an advisory lock
inside the destructive admin transaction.

### P1 - `is_staff` is not just display metadata today

The current resolver grants `catalog.edit` to `is_staff`. The admin plan
correctly says `is_staff` is not the admin gate, but toggling it still changes a
real capability.

Required correction: either do not expose `is_staff` toggles in the first UI, or
gate them with fresh admin re-auth and audit them like capability changes.

## Best-Practice Assessment

The plan is directionally strong: invite-only accounts, no public signup, no
temporary passwords, hashed single-use expiring tokens, backend capability
checks, immediate session revocation, MCP-token revocation, audit logging, and
last-admin protection are the right foundation.

The plan was not yet production-complete because it under-specified CSRF,
durable rate limiting, fresh admin re-authentication, account-state schema, and
bootstrap/rollout sequencing. Those are now promoted into blocking phases.

MFA/passkeys are not required to unblock the two-user internal production
cutover, but they should become a blocker before broad external/client access or
real team/account sharing.

## Primary Use-Case Coverage

Covered after the PRD/phase update:

- first admin bootstrap without a temporary password;
- Ed invites John;
- John completes invite and signs in normally;
- self-service reset;
- admin-triggered reset;
- resend/revoke invite;
- deactivate/reactivate user;
- immediate session and MCP-token revocation;
- grant/revoke `admin.users.manage`;
- avoid last-admin lockout;
- inspect recent user/admin audit activity;
- break-glass recovery when no admin can sign in or email delivery fails.

Still deferred by design:

- MFA/passkeys;
- external client/certifier user accounts;
- team/tenant role enforcement;
- audit export tooling;
- automated token-cleanup job.

## Rollout Gate

Admin-user-management should unblock `planning/features/v2-production-rollout/`
only after:

1. Phases 00-07 pass their exit criteria.
2. `make ci` passes.
3. Ed can bootstrap his production admin account.
4. Ed can invite John through the app.
5. A test account reset/deactivate/reactivate/admin-grant cycle is verified.
6. Audit rows are visible or queryable for each sensitive action.
