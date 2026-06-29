---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Complete
AUTHOR: Codex (for Ed May)
SCOPE: Security and use-case review for the admin-user-management MVP packet.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
  - ../research.md
  - ../../../2026-06-28/v2-production-rollout/PLAN.md
---

# Security / Use-Case Review - Admin User Management MVP

## MVP Split Addendum

Ed narrowed this packet on 2026-06-27 to the near-term Ed/John production MVP.
This feature kept the durable foundations and core admin operations:
first-admin bootstrap, invite John, admin-generated reset links,
deactivate/reactivate, `admin.users.manage` grant/revoke, last-admin protection,
Origin/CSRF posture for admin mutations, and audit rows.

The following review findings remain valid but are no longer MVP blockers:
public self-service reset, transactional email delivery, durable internet-facing
public reset/invite-resend rate limiting, fresh admin re-authentication,
MFA/passkeys, audit export, `Catalog Admin`, `is_staff` editing, external
users, certifier/client accounts, teams, and broader IAM. These were split into
`planning/features_v2.0/public-account-recovery/`,
`planning/features_v2.0/account-security-hardening/`,
`planning/features_v2.0/access-capability-enforcement/`, and
`planning/features_v2.0/multi-tenant-teams/`.

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

### P1 - Admin re-auth should be deferred but tracked

The prior plan left admin re-authentication open. Best practice for sensitive
account changes is a fresh-auth gate, but it is more than the Ed/John MVP needs.

Required correction: keep it out of the MVP implementation path and track it in
`planning/features_v2.0/account-security-hardening/`. When promoted, prefer a
`POST /api/v1/auth/reauth` route with a short fresh-auth window over passing the
admin password to every mutation.

### P1 - Public rate limiting moves with public reset

The plan mentioned rate limiting but not where it lives. Public reset is
internet-facing; process memory is too weak as the only control. Since public
reset is now deferred, durable public rate limiting defers with it.

Required correction: implement a DB-backed limiter or equivalent platform
control in `planning/features_v2.0/public-account-recovery/` before any public
reset or invite-resend endpoint ships.

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

Required correction: do not expose `is_staff` toggles in the MVP UI. If exposed
later, gate them with fresh admin re-auth and audit them like capability
changes.

## Best-Practice Assessment

The plan is directionally strong: invite-only accounts, no public signup, no
temporary passwords, hashed single-use expiring tokens, backend capability
checks, immediate session revocation, MCP-token revocation, audit logging, and
last-admin protection are the right foundation.

The plan was not yet production-complete because it mixed MVP foundations with
broader account-recovery and hardening. CSRF/Origin posture, account-state
schema, token hashing, last-admin protection, and bootstrap/rollout sequencing
remain blocking. Public reset, durable public rate limiting, email delivery, and
fresh admin re-auth are deferred to named v2.0 packets.

MFA/passkeys are not required to unblock the two-user internal production
cutover, but they should become a blocker before broad external/client access or
real team/account sharing.

## Primary Use-Case Coverage

Covered by the MVP PRD/phase update:

- first admin bootstrap without a temporary password;
- Ed invites John;
- John completes invite and signs in normally;
- admin-generated reset link;
- deactivate/reactivate user;
- immediate session and MCP-token revocation;
- grant/revoke `admin.users.manage`;
- avoid last-admin lockout;
- inspect recent user/admin audit activity or SQL fallback;
- break-glass recovery when no admin can sign in.

Still deferred by design:

- MFA/passkeys;
- public self-service reset;
- transactional email delivery;
- durable public reset/invite-resend rate limiting;
- fresh admin re-authentication;
- `Catalog Admin` and `is_staff` editing UI;
- external client/certifier user accounts;
- team/tenant role enforcement;
- audit export tooling;
- automated token-cleanup job.

## Rollout Gate

Admin-user-management should unblock `planning/archive/dated/2026-06-28/v2-production-rollout/`
only after:

1. Phases 00-06 pass their MVP exit criteria.
2. `make ci` passes.
3. Ed can bootstrap his production admin account.
4. Ed can invite John through the app.
5. A test account reset-link/deactivate/reactivate/admin-grant cycle is
   verified.
6. Audit rows are visible or queryable for each sensitive action.
