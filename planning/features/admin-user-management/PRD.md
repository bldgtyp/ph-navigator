---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Product and security contract for PH-Navigator admin user management.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
  - ./research.md
---

# PRD - Admin User Management

## Goal

Give BLDGTYP a small, production-grade user administration surface for
PH-Navigator V1:

- see active/inactive users;
- invite a new user;
- trigger a password reset;
- deactivate or reactivate a user;
- assign or revoke admin-level capabilities;
- inspect recent user/admin audit activity.

The feature should be simple enough for a two-person internal tool but should
not create security debt that must be unwound later.

This is now a required precondition for the production rollout. The rollout can
rehearse infrastructure, but it should not cut `www.ph-nav.com` over to the new
app until account invite/reset/revoke/admin-grant flows pass.

## Primary Use Cases

1. **Bootstrap first production admin** - an operator creates/repairs Ed's
   first admin account with an audited command that issues an invite/reset link,
   not a reusable temporary password.
2. **Invite John** - Ed invites John, chooses the initial role preset, John sets
   his own password from a single-use link, and then signs in normally.
3. **Recover access** - Ed or John can request self-service reset from the sign
   in page; an admin can also trigger a reset for another user.
4. **Revoke a user immediately** - an admin deactivates a user after a staff
   change or suspected compromise; sessions, account tokens, invite/reset
   tokens, and attributable MCP tokens stop working.
5. **Repair or resend an invite** - an admin can resend an expired invite or
   revoke a mistaken invite without creating duplicate user records.
6. **Maintain two-admin resilience** - Ed can grant John admin rights so there
   is a backup admin; the backend prevents deleting/demoting the last active
   admin.
7. **Manage catalog/staff privileges deliberately** - admin user management can
   grant/revoke admin and catalog capabilities without conflating them with the
   BLDGTYP `is_staff` marker.
8. **Audit sensitive changes** - Ed can answer "who invited/reset/deactivated/
   granted what, when, and from where" from an in-app admin audit view or a
   documented SQL fallback.
9. **Operate when email is down** - a documented break-glass command can issue
   a new reset/invite link for an active admin without weakening password
   storage or bypassing audit.

## Non-Goals

- Public account registration.
- Client/customer self-signup.
- Social/OAuth login.
- Full enterprise IAM.
- Project/team sharing UI.
- Multi-factor authentication in the blocking implementation pass.
- External client/certifier account management.

## Users

### Normal User

Can sign in, edit projects according to the current app rules, manage their own
units preference, and request a password reset for their own account.

### Admin User

Can manage users and user lifecycle operations through the admin dashboard.
Admin status is not merely a label; sensitive actions require the backend
capability `admin.users.manage`.

### Production Operator

Can run a narrow, audited bootstrap/repair command from a trusted shell to create
the first active admin or issue a recovery link when no admin can sign in. This
is not normal account management and must not grant broad SQL/script access to
routine user lifecycle tasks.

## Role And Capability Model

Use a small role-preset UI over the existing capability substrate:

| UI preset | Backend state | Meaning |
| --- | --- | --- |
| User | active user, no admin grants | Normal PH-Navigator user |
| Admin | active user with `admin.users.manage` | Can manage users and user lifecycle |
| Catalog Admin | active user with `catalog.edit` | Can edit shared catalogs without user-admin powers |
| Inactive | `users.deleted_at IS NOT NULL` | Cannot sign in; sessions/tokens revoked |

Keep `users.is_staff` as a BLDGTYP staff/support marker. It can be displayed in
the dashboard, but it must not be the only gate for admin actions. Today
`is_staff` also grants `catalog.edit` through the current resolver, so changing
it is a sensitive action that requires admin re-authentication and audit.

Future capability examples:

- `catalog.edit`
- `admin.audit.read`
- `project.share.manage`
- `team.manage`

## Admin Dashboard

Route: `/admin/users`

Navigation:

- show only for users with `admin.users.manage`;
- direct access by non-admins returns 403 from the API and a plain "not
  authorized" shell in the frontend.

User list fields:

- display name;
- email;
- status: active, invited, inactive;
- role preset: User, Admin;
- `is_staff`;
- created date;
- last login date, derived from sessions/audit;
- active session count;
- recent admin action timestamp.

Actions:

- invite user;
- resend invite;
- trigger password reset;
- deactivate user;
- reactivate user;
- grant/revoke Admin preset;
- view recent audit events for that user.

## Invite User

Admin inputs:

- email;
- display name;
- role preset;
- optional `is_staff`.

Behavior:

1. Backend validates admin capability.
2. Backend creates or reactivates a user in a pending/invited state.
3. Backend creates a cryptographically random invite token.
4. Only a keyed hash of the token is stored; raw tokens are never persisted.
5. Token is single-use and expires.
6. Email sends the user an HTTPS invite link on the canonical app domain.
7. Invite page lets the user set their own password.
8. Completing invite invalidates the token and signs the user in only through
   the normal login flow, not automatically from the token.

No admin-visible temporary password is allowed.

Account-state requirements:

- `password_hash` must be nullable or otherwise have an explicit unusable
  pending state; pending invites must not authenticate with a placeholder
  password.
- add enough user state to distinguish `active`, `invited`, and `inactive`
  without overloading `deleted_at`;
- re-inviting an existing inactive user must preserve audit/project history;
- duplicate active invites follow one explicit policy: revoke-and-replace is
  preferred so only the latest link works.

## Password Reset

Two entry points use the same reset-token machinery:

- self-service "Forgot password" from sign-in;
- admin-triggered reset from `/admin/users`.

Request behavior:

- self-service response is generic for existing and non-existing emails;
- response timing should not reveal whether the email exists;
- rate-limit per email and per IP;
- do not deactivate, lock, or otherwise mutate the account until a valid token
  is presented.

Token behavior:

- generated by a cryptographically secure random generator;
- stored only as a keyed HMAC/SHA-256-style hash using a server secret, or an
  equivalently reviewed one-way token hash;
- linked to one user;
- single-use;
- expires after a short window;
- never logged;
- delivered only through the configured side channel, initially email.
- preferably carried in the frontend URL fragment, not the query string, so the
  token is not sent to static-host access logs; the API receives it only in a
  JSON body over HTTPS.

Completion behavior:

- user enters and confirms the new password;
- password is hashed through the existing Argon2id path;
- all active sessions for that user are invalidated;
- active MCP tokens for that user/project scope are revoked if the current MCP
  model can attribute them to the user;
- user gets a reset-completed email notification;
- user then signs in through the normal login form.

The first implementation ships both self-service and admin-triggered reset.
This intentionally supersedes the old MVP decision of admin-script-only reset,
because production account recovery is now a rollout blocker.

## Deactivate / Reactivate

Deactivate:

- set `users.deleted_at`;
- invalidate active sessions;
- revoke active MCP tokens attributable to that user;
- revoke invite/reset tokens for that user;
- preserve projects, audit rows, and historical created_by/updated_by records;
- prevent deactivating the last active admin.

Reactivate:

- clear `users.deleted_at`;
- send invite/reset link so the user chooses a current password;
- do not silently restore old sessions or tokens.

## Audit

Admin actions must write `user_action_log` rows with:

- acting admin user id;
- target user id/email;
- action key;
- request IP/user agent;
- before/after details where useful, excluding secrets and tokens.

If the current `user_action_log` columns are not enough for efficient
per-target admin history, add `target_user_id` / `target_email` columns and
indexes rather than burying every lookup in unindexed JSONB.

Required actions:

- `admin_user_invited`
- `admin_invite_resent`
- `password_reset_requested`
- `admin_password_reset_requested`
- `password_reset_completed`
- `admin_user_deactivated`
- `admin_user_reactivated`
- `admin_capability_granted`
- `admin_capability_revoked`

## Security Requirements

- Deny by default: every admin API requires explicit capability checks.
- Authorize on the backend for every request; frontend hiding is only
  convenience.
- Do not expose password hashes, invite tokens, reset tokens, session ids, or
  MCP token plaintext in API responses.
- Require fresh admin re-authentication for sensitive actions.
- Reject unsafe credentialed requests from untrusted origins. If production
  keeps `SameSite=None`, add CSRF middleware with Origin validation and an
  app-only custom header/token; preferred production hardening is proving
  `SameSite=Lax` works for `www.ph-nav.com` -> `api.ph-nav.com`.
- Return generic reset-request responses.
- Apply real rate limiting to reset/invite resend endpoints. Do not rely only
  on process memory for internet-facing reset.
- Prevent last-admin lockout.
- Enforce last-admin checks transactionally so concurrent demotions/deactivations
  cannot race.
- Generate links from configured canonical frontend base URL, never request
  `Host`.
- Scrub tokens and passwords from logs, audit details, request bodies, and
  frontend error reporting.
- Add backend integration tests for unauthorized, normal-user, admin, inactive
  user, expired token, reused token, CSRF/origin rejection, rate limiting, and
  last-admin cases.

## Acceptance Criteria

1. An admin can invite John from `/admin/users`, John receives a link, sets a
   password, and then signs in normally.
2. A normal user cannot load user admin data or call admin endpoints.
3. Admin-triggered reset sends a reset link without revealing or setting a
   temporary password.
4. Reset tokens expire and cannot be reused.
5. Completing a password reset invalidates existing sessions.
6. Deactivated users cannot sign in; existing sessions stop working.
7. Last active admin cannot be deactivated or demoted.
8. Sensitive admin actions appear in the audit log.
9. Unsafe admin mutations are rejected without trusted Origin + CSRF/custom
   header protection, or production is verified on `SameSite=Lax`.
10. Public reset and invite resend endpoints are rate-limited.
11. The production rollout plan is updated so admin-user-management is no
    longer a follow-up dependency.
12. `make ci` passes, with focused backend/frontend coverage for the new flows.
