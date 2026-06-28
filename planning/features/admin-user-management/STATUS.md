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

**State:** Planned / production-rollout blocker for the **two-user internal
MVP**. Product/security contract drafted; implementation has not started.

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
11. **Cookie/Origin posture is still a blocker** - do not ship admin mutations
    with credentialed cookies unless unsafe methods reject untrusted origins and
    require an app-only CSRF/custom header, or production cookies are proven to
    work with `SameSite=Lax`.

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

## Open Decisions

1. **MVP token lifetimes** - proposed defaults: invite 7 days; admin-generated
   reset 30 minutes.
2. **Manual link handling** - decide whether MVP reset/invite links are shown
   once in the admin UI, printed only by bootstrap/break-glass commands, or both.
3. **Cookie hardening path** - decide in Phase 01 whether production moves to
   `SameSite=Lax` for `www.ph-nav.com` -> `api.ph-nav.com`, or keeps
   `SameSite=None` with explicit CSRF/Origin/custom-header protection.

## Next Step

Phase 00: lock the MVP/deferred boundary, token lifetimes, manual link-handling
policy, and cookie/CSRF approach. Then start Phase 01 before admin mutation
routes.

## Verification

Docs-only pass so far:

- Current backend auth/access files inspected.
- OWASP/NIST guidance reviewed and summarized in `research.md`.
- Security/use-case review added in
  `reviews/2026-06-27-security-use-case-review.md`.
- Deferred scopes split into `planning/features_v2.0/`.
- Phase plans updated under `phases/`.
- No code or runtime verification performed for this feature.
