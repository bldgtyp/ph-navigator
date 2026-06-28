---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Current state and decisions for the Admin User Management MVP.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./research.md
  - ./reviews/2026-06-27-security-use-case-review.md
  - ./phases/
  - ../../features_v2.0/public-account-recovery/
  - ../../features_v2.0/account-security-hardening/
---

# Status - Admin User Management MVP

**State:** Phases 00–05 complete and Phase 06 implementation complete (`make ci`
green). The full two-user MVP — bootstrap, invite, admin reset link,
deactivate/reactivate, Admin grant/revoke, last-admin protection, CSRF/Origin
guard, capability-gated UI, and audit — is built and tested end-to-end.
**Remaining before the rollout gate clears:** the manual staging/prod-shape
rehearsal + browser smoke (Ed; see `phases/phase-06-production-rehearsal.md`).

## Why This Exists

V1 currently has only direct credential login plus script/operator-driven user
creation. That is enough to bootstrap Ed + John locally, but it is not enough
for normal production operations:

- no app-level admin dashboard for users;
- no invite/create-user workflow;
- no production-safe admin-generated reset-link workflow;
- no in-app deactivate/reactivate path;
- no in-app `admin.users.manage` grant/revoke path;
- no operator-friendly audit evidence for sensitive account actions.

## Current Code Facts

- `users.deleted_at` already supports soft deactivation.
- `sessions.invalidated_at` / `invalidation_reason` already support session
  revocation.
- `user_action_log` already records auth events.
- `users.is_staff` and `user_grants` already exist from the access-capability
  foundation migration.
- `scripts.manage_user_access` can grant/revoke capabilities and toggle
  `is_staff`, but only as local/staging operator tooling. It refuses production.
- There is no production-safe public/admin route for user creation, reset, or
  role management.
- There is no CSRF middleware or unsafe-method Origin gate today. The production
  rollout currently plans split-origin `www` -> `api` cookie auth, so this MVP
  must either move production cookies to same-site `SameSite=Lax` or add minimal
  explicit CSRF/Origin protection before admin mutations ship.
- `UserPublic` / `/api/v1/auth/session` do not expose capability keys today, so
  frontend admin navigation cannot be safely affordance-gated without a session
  contract change.
- `mcp_tokens` are attributable to `issued_by_user_id`, but there is no current
  repository helper to revoke every active token for a user across projects.

## MVP Decisions

1. **Invite-only users** - no public sign-up.
2. **No temporary passwords** - invites and resets use single-use, expiring,
   hashed account tokens. Admins do not set or view another user's password.
3. **Admin-generated reset links are in MVP** - an admin can issue a reset link
   for another user. Public "Forgot password" is deferred.
4. **Manual link delivery is acceptable for MVP** - the app/operator path may
   expose a one-time invite/reset link to the acting admin/operator for direct
   delivery to John. Transactional email is deferred.
5. **Capability-based admin** - add `admin.users.manage` as the gate for user
   lifecycle operations; use the existing `user_grants` pattern instead of a
   hard-coded broad superuser.
6. **Preserve `is_staff`** - use it as the BLDGTYP staff marker / support flag.
   Do not expose `is_staff` editing in the MVP UI.
7. **Revoke means immediate lockout** - deactivation invalidates active sessions
   and attributable MCP tokens while preserving historical records.
8. **Audit every sensitive MVP action** - invite, reset-link generated, reset
   completed, deactivate, reactivate, admin grant, admin revoke.
9. **Prevent last-admin lockout** - backend rejects deactivating/demoting the
   last active `admin.users.manage` account.
10. **Production bootstrap is audited and narrow** - the only acceptable
    production operator path creates or repairs the first admin and issues an
    invite/reset link; it must not set a reusable temporary password.
11. **Cookie/Origin posture is locked (defense-in-depth)** - production defaults
    to `SameSite=Lax` **and** every unsafe credentialed admin mutation is gated
    by a trusted-`Origin` allow-list plus an app-only custom header
    (`X-PHN-CSRF`). The guard ships regardless of the staging `SameSite` check.

## Deferred Out Of MVP

| Deferred scope | Destination |
| --- | --- |
| Public self-service "Forgot password" | `planning/features_v2.0/public-account-recovery/` |
| Transactional email provider/templates and email notices | `planning/features_v2.0/public-account-recovery/` |
| Durable internet-facing reset/invite-resend rate limiting | `planning/features_v2.0/public-account-recovery/` |
| Fresh admin re-authentication / step-up auth | `planning/features_v2.0/account-security-hardening/` |
| MFA/passkeys/recovery codes | `planning/features_v2.0/account-security-hardening/` |
| Session/device inventory and suspicious reset/invite alerting | `planning/features_v2.0/account-security-hardening/` |
| Audit export and automated expired-token cleanup jobs | `planning/features_v2.0/account-security-hardening/` |
| `Catalog Admin`, `is_staff` editing UI, richer roles/IAM | `planning/features_v2.0/access-capability-enforcement/` |
| Teams, external members, client/certifier accounts | `planning/features_v2.0/multi-tenant-teams/` and `planning/features_v2.0/access-capability-enforcement/` |

## Locked Decisions (Phase 00, 2026-06-27)

1. **MVP token lifetimes** - LOCKED: invite tokens live **7 days**;
   admin-generated reset tokens live **30 minutes**. Both single-use and hashed.
   Lifetimes are `Settings` fields so they can be tuned without a migration.
2. **Manual link handling** - LOCKED: **both**. The raw one-time link is returned
   exactly once in the immediate create/reset-link API response (shown once in the
   admin UI with a copy affordance) **and** printed once by the bootstrap/
   break-glass command. It is never persisted, re-displayed, audited, or logged.
3. **Cookie hardening path** - LOCKED: **defense-in-depth, not either/or**.
   Production defaults to `SameSite=Lax` for `www.ph-nav.com` ->
   `api.ph-nav.com`, **and** every unsafe credentialed admin mutation is
   independently gated by a trusted-`Origin` allow-list plus an app-only custom
   header (`X-PHN-CSRF`). The guard ships regardless of the staging `SameSite`
   verification result, so the rollout gate cannot be blocked on that one check.

## Next Step

Implementation is complete. The remaining work is the manual
staging/prod-shape rehearsal + browser smoke owned by Ed, tracked in
`phases/phase-06-production-rehearsal.md`. Once that passes, mark the
`v2-production-rollout` MVP gate cleared and archive this packet.

## Verification

Planning + implementation (Phases 00–06), `make ci` green throughout:

- OWASP/NIST guidance reviewed in `research.md`; security/use-case review in
  `reviews/2026-06-27-security-use-case-review.md`; deferred scopes split into
  `planning/features_v2.0/`.
- Phase 01 — Origin + `X-PHN-CSRF` guard (`backend/tests/test_csrf_guard.py`,
  `frontend/src/shared/api/client.test.ts`).
- Phase 02 — schema/bootstrap (`backend/tests/test_admin_account_schema.py`).
- Phase 03 — services + completion (`backend/tests/test_admin_service.py`).
- Phase 04 — routes + authorization (`backend/tests/test_admin_routes.py`).
- Phase 05 — admin UI + completion pages (`frontend/src/features/admin/__tests__`,
  `frontend/src/features/auth/routes/__tests__/AccountCompletePage.test.tsx`).
- Phase 06 — runbook in `context/ENVIRONMENT.md`; `scripts.bootstrap_admin`
  smoke-checked. **Manual staging rehearsal + browser smoke still pending.**
