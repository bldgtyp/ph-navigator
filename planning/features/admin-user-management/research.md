---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Draft
AUTHOR: Codex (for Ed May)
SCOPE: Security guidance and current-code findings for admin user management.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
---

# Research - Admin User Management

## Primary Guidance Reviewed

- OWASP Forgot Password Cheat Sheet:
  `https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html`
- OWASP Authorization Cheat Sheet:
  `https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html`
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet:
  `https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html`
- OWASP Session Management Cheat Sheet:
  `https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html`
- OWASP Authentication Cheat Sheet:
  `https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html`
- NIST SP 800-63B:
  `https://pages.nist.gov/800-63-4/sp800-63b.html`

## Relevant Guidance

### Password Reset

OWASP's reset guidance maps directly to this feature:

- return a consistent message for existing and non-existing accounts;
- keep response timing consistent enough to avoid user enumeration;
- rate-limit reset requests;
- use side-channel delivery;
- use cryptographically random tokens;
- store reset tokens securely;
- make tokens single-use and expiring;
- do not mutate/lock the account until a valid token is presented;
- after reset, notify the user and require normal login rather than
  automatically logging them in.

Planning implication: no admin-set temporary passwords. Admin-triggered reset
creates the same email reset flow as self-service reset.

### Authorization

OWASP's authorization guidance emphasizes:

- least privilege;
- deny by default;
- validate permissions on every request;
- prefer contextual permission checks over relying only on coarse roles;
- log authorization-sensitive actions;
- test authorization logic.

Planning implication: expose `Admin` as a UI role preset, but gate backend
actions through explicit capabilities such as `admin.users.manage`.

### CSRF And Cookie Posture

OWASP's CSRF guidance treats cookie-authenticated unsafe methods as CSRF
targets and recommends defenses such as synchronizer/double-submit tokens,
custom request headers for AJAX APIs, Origin/Referer validation, and SameSite
cookies as defense in depth.

Planning implication: the production rollout's split-origin
`www.ph-nav.com` -> `api.ph-nav.com` cookie model must be settled before admin
mutations ship. Preferred hardening is to prove production works with
`SameSite=Lax` because the frontend and API are same-site under `ph-nav.com`.
If `SameSite=None` remains, add explicit CSRF middleware that rejects unsafe
requests without trusted Origin and an app-only CSRF/custom header.

### Sensitive Action Reauthentication

OWASP and NIST both call out reauthentication around sensitive account changes.

Planning implication: do not leave admin re-auth as optional. Changing another
user's password-reset state, deactivation state, `admin.users.manage`,
`catalog.edit`, or `is_staff` needs a fresh admin password check or fresh-auth
session marker.

### Authenticator Lifecycle

NIST SP 800-63B treats authenticator binding/recovery/revocation as lifecycle
events that should be recorded, notified, and protected by appropriate
authentication. It also recommends multiple authenticators for recovery in
systems that go beyond simple password-only assurance.

Planning implication: PH-Navigator can ship password-only admin lifecycle for
the two-user V1 cutover, but MFA/passkeys should remain a hardening candidate
before broader external/client access.

## Current PH-Navigator Code Findings

Auth routes:

- `backend/features/auth/routes.py` exposes login, session, preferences, logout.
- No public signup.
- No password reset routes.
- No invite routes.
- No admin user-management routes.

Auth service/repository:

- `create_or_update_user()` exists, but is a backend helper currently used by
  scripts/tests, not a production admin API.
- `authenticate()` uses a generic login failure and logs failed attempts.
- Login invalidates previous sessions for the user, enforcing the current
  single-active-session rule.
- `current_user_from_request()` rejects invalidated/expired sessions and
  inactive users.
- `invalidate_active_sessions()` exists and can support deactivate/reset.
- Session cookies are `HttpOnly`, configurable `SameSite`, and secure outside
  local/test through `settings.session_cookie_secure`.
- No CSRF middleware, CSRF token, or unsafe-method Origin rejection was found.

Schema:

- `users.email`, `users.display_name`, `users.password_hash`,
  `users.deleted_at`, `users.units_preference` exist.
- `users.password_hash` is currently `NOT NULL`; invite-pending users need a
  real account-state migration rather than a placeholder password.
- `users.is_staff` exists from the access-capability foundation migration.
- `user_grants` exists with `capability`, `scope_type`, `scope_id`,
  `granted_by`, `granted_at`, `revoked_at`.
- `sessions` support invalidation.
- `user_action_log` exists.
- `mcp_tokens` include `issued_by_user_id` and `revoked_at`, but current
  helpers revoke by project/token id rather than "all active tokens for user".

Access tooling:

- `backend/scripts/manage_user_access.py` can grant/revoke arbitrary
  capabilities and toggle `is_staff`.
- The script refuses production through `assert_local_or_staging()`, so it is
  intentionally not a prod admin mechanism.

Frontend:

- sign-in form only.
- session query exposes `UserPublic`, which currently lacks role/capability
  fields.
- no admin route or nav.

## Design Consequences

1. The existing `user_grants` table is the right foundation for admin rights.
2. `is_staff` should stay useful, but sensitive actions should check
   `admin.users.manage`.
3. A token table is the main missing backend primitive.
4. Email delivery is the main missing infrastructure dependency.
5. Session invalidation and audit logging already have usable seams.
6. CSRF/rate-limit/fresh-auth controls are not optional add-ons; they are part
   of the security foundation for public reset and admin mutations.
7. Pending-invite account state needs a schema change because current users
   require `password_hash`.
