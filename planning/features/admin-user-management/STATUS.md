---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Current state and decisions for admin user-management planning.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./research.md
  - ./reviews/2026-06-27-security-use-case-review.md
  - ./phases/
---

# Status - Admin User Management

**State:** Planned / production-rollout blocker. Product/security contract
drafted; implementation has not started.

## Why This Exists

V1 currently has only direct credential login plus script/operator-driven user
creation. That is enough to bootstrap Ed + John, but it is not enough for normal
production operations:

- no admin dashboard for users;
- no invite/create-user workflow;
- no self-service or admin-triggered password reset;
- no in-app deactivate/reactivate path;
- no in-app role/capability management;
- no operator-friendly view into user status, sessions, or audit history.

## Current Code Facts

- `users.deleted_at` already supports soft deactivation.
- `sessions.invalidated_at` / `invalidation_reason` already support session
  revocation.
- `user_action_log` already records auth events.
- `users.is_staff` and `user_grants` already exist from the access-capability
  foundation migration.
- `scripts.manage_user_access` can grant/revoke capabilities and toggle
  `is_staff`, but only as local/staging operator tooling. It refuses
  production.
- There is no production-safe public/admin route for user creation, reset, or
  role management.
- There is no CSRF middleware or unsafe-method Origin gate today. The production
  rollout currently plans split-origin `www` -> `api` cookie auth, so this
  feature must either move production cookies to same-site `SameSite=Lax` or add
  explicit CSRF protection before admin mutations ship.
- `UserPublic` / `/api/v1/auth/session` do not expose capability keys today, so
  frontend admin navigation cannot be safely affordance-gated without a session
  contract change.
- `mcp_tokens` are attributable to `issued_by_user_id`, but there is no current
  repository helper to revoke every active token for a user across projects.

## Settled Planning Decisions

1. **Invite-only users** - no public sign-up.
2. **No temporary passwords** - invites and password resets use single-use,
   expiring, hashed tokens delivered through a side channel.
3. **Admin-triggered reset sends a reset link** - admins do not set or view a
   user's password.
4. **Capability-based admin** - add `admin.users.manage` as the gate for user
   lifecycle operations; use the existing `user_grants` pattern instead of a
   hard-coded broad superuser.
5. **Preserve `is_staff`** - use it as the BLDGTYP staff marker / support flag,
   not as the only authorization check for sensitive admin actions.
6. **Revoke means immediate lockout** - deactivation invalidates active sessions
   and MCP tokens while preserving historical records.
7. **Audit every sensitive action** - invite, reset requested, reset completed,
   deactivate, reactivate, role/capability grant, role/capability revoke.
8. **Prevent last-admin lockout** - backend rejects deactivating/demoting the
   last active `admin.users.manage` account.
9. **Self-service reset is in the first pass** - this intentionally supersedes
   the old two-person MVP decision of admin-script-only reset. Public reset
   requires generic responses, rate limiting, and token-only account mutation.
10. **Admin re-authentication is required** - reset, deactivate/reactivate,
    `admin.users.manage`, `catalog.edit`, and `is_staff` changes require a fresh
    admin password check or fresh-auth session marker.
11. **Production bootstrap is audited and narrow** - the only acceptable
    production operator path creates or repairs the first admin and issues an
    invite/reset link; it must not set a reusable temporary password.
12. **CSRF/cookie posture is a blocker** - do not ship admin mutations with
    credentialed cookies unless unsafe methods reject untrusted origins and
    require an app-only CSRF/custom header, or production cookies are proven to
    work with `SameSite=Lax`.

## Open Decisions

1. **Email provider** - choose a production email delivery path before Phase 05:
   Resend, Postmark, SMTP, or Render-managed integration if available.
2. **Initial role presets** - likely `User` and `Admin`, with `Admin` mapping to
   `admin.users.manage` plus any future admin capabilities. Need decide whether
   `Catalog Admin` remains a separate preset or only a capability.
3. **Token lifetimes** - proposed defaults: invite 7 days; password reset 30
   minutes; fresh-admin re-auth 10 minutes.
4. **MFA/passkeys** - not required for the first two-user V1 cutover, but should
   be considered before broad external client access or project sharing.
5. **Cookie hardening path** - decide in Phase 01 whether production moves to
   `SameSite=Lax` for `www.ph-nav.com` -> `api.ph-nav.com`, or keeps
   `SameSite=None` with explicit CSRF middleware.

## Next Step

Phase 00: lock the email provider decision, role preset names, token lifetimes,
and cookie/CSRF approach. Then start Phase 01 before public reset/admin routes.

## Verification

Docs-only pass so far:

- Current backend auth/access files inspected.
- OWASP/NIST guidance reviewed and summarized in `research.md`.
- Security/use-case review added in `reviews/2026-06-27-security-use-case-review.md`.
- Phase plans added under `phases/`.
- No code or runtime verification performed for this feature.
