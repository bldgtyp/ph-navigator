---
DATE: 2026-06-27
TIME: 20:18 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Product and security contract for the Admin User Management MVP.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
  - ./research.md
  - ../../features_v2.0/public-account-recovery/
  - ../../features_v2.0/account-security-hardening/
---

# PRD - Admin User Management MVP

## Goal

Give BLDGTYP the smallest production-grade user administration surface needed
for PH-Navigator V1's near-term Ed/John launch:

- bootstrap the first production admin without a reusable password;
- invite John with a one-time link;
- generate an admin reset link;
- deactivate/reactivate a user;
- grant/revoke the `Admin` preset backed by `admin.users.manage`;
- preserve minimal audit evidence for sensitive account actions.

The feature should stay simple for a two-person internal tool while keeping the
account-state, token, authorization, and audit foundations that would be painful
to unwind later.

This is a required precondition for the production rollout. The rollout can
rehearse infrastructure, but it should not cut `www.ph-nav.com` over to the new
app until the MVP account invite/reset-link/revoke/admin-grant flows pass.

## Primary MVP Use Cases

1. **Bootstrap first production admin** - an operator creates/repairs Ed's
   first admin account with an audited command that issues an invite/reset link,
   not a reusable temporary password.
2. **Invite John** - Ed invites John, chooses the `User` or `Admin` preset, John
   sets his own password from a single-use link, and then signs in normally.
3. **Recover access by admin reset link** - Ed or John can generate a one-time
   reset link for the other admin/user and deliver it manually.
4. **Revoke a user immediately** - an admin deactivates a user after a staff
   change or suspected compromise; sessions, account tokens, invite/reset
   tokens, and attributable MCP tokens stop working.
5. **Reactivate a user** - an admin reactivates the account and issues a new
   reset/invite link; old sessions/tokens are not restored.
6. **Maintain two-admin resilience** - Ed can grant John admin rights so there
   is a backup admin; the backend prevents deactivating/demoting the last active
   admin.
7. **Audit sensitive changes** - Ed can answer "who invited/reset/deactivated/
   granted what, when, and from where" from audit rows, even if the first UI only
   shows a minimal recent-history view or documented SQL fallback.

## Non-Goals For This MVP

- Public account registration.
- Public self-service "Forgot password".
- Transactional email delivery and email templates.
- Client/customer self-signup.
- Social/OAuth login.
- Fresh admin re-authentication / step-up auth.
- Multi-factor authentication or passkeys.
- Full enterprise IAM.
- Project/team sharing UI.
- External client/certifier account management.
- `Catalog Admin` preset or `is_staff` editing UI.
- Audit export tooling.

## Users

### Normal User

Can sign in, edit projects according to the current app rules, and manage their
own units preference.

### Admin User

Can manage MVP user lifecycle operations through the admin dashboard. Admin
status is not merely a label; sensitive actions require the backend capability
`admin.users.manage`.

### Production Operator

Can run a narrow, audited bootstrap/repair command from a trusted shell to
create the first active admin or issue a recovery link when no admin can sign
in. This is not normal account management and must not grant broad SQL/script
access to routine user lifecycle tasks.

## Role And Capability Model

Use a small role-preset UI over the existing capability substrate:

| UI preset | Backend state | Meaning |
| --- | --- | --- |
| User | active user, no admin grants | Normal PH-Navigator user |
| Admin | active user with `admin.users.manage` | Can manage MVP user lifecycle |
| Inactive | `users.deleted_at IS NOT NULL` | Cannot sign in; sessions/tokens revoked |

Keep `users.is_staff` as a BLDGTYP staff/support marker. It can be displayed in
the dashboard if useful, but it is not editable in the MVP and must not be the
only gate for admin actions.

Future role/capability expansion is tracked in
`planning/features_v2.0/access-capability-enforcement/`.

## Admin Dashboard

Route: `/admin/users`

Navigation:

- show only for users with `admin.users.manage`;
- direct access by non-admins returns 403 from the API and a plain "not
  authorized" shell in the frontend.

MVP user list fields:

- display name;
- email;
- status: active, invited, inactive;
- role preset: User or Admin;
- created date;
- recent sensitive action timestamp if cheap from audit data.

MVP actions:

- invite user;
- generate reset link;
- deactivate user;
- reactivate user;
- grant/revoke Admin preset;
- view minimal recent audit events or link to documented SQL fallback.

Deferred dashboard polish:

- active session count;
- last login date;
- `Catalog Admin`;
- editable `is_staff`;
- full audit drawer/export.

## Invite User

Admin inputs:

- email;
- display name;
- role preset: User or Admin.

Behavior:

1. Backend validates admin capability.
2. Backend creates or reactivates a user in a pending/invited state.
3. Backend creates a cryptographically random invite token.
4. Only a keyed hash of the token is stored; raw tokens are never persisted.
5. Token is single-use and expires.
6. MVP delivery may show the raw link exactly once to the acting admin/operator
   for manual delivery.
7. Invite page lets the user set their own password.
8. Completing invite invalidates the token and requires normal sign-in.

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

## Admin-Generated Reset Link

MVP reset is admin-triggered only.

Request behavior:

- admin selects a target user from `/admin/users`;
- backend validates `admin.users.manage`;
- backend creates a single-use reset token;
- MVP delivery may show the raw link exactly once to the acting admin/operator
  for manual delivery;
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
- preferably carried in the frontend URL fragment, not the query string, so the
  token is not sent to static-host access logs; the API receives it only in a
  JSON body over HTTPS.

Completion behavior:

- user enters and confirms the new password;
- password is hashed through the existing Argon2id path;
- all active sessions for that user are invalidated;
- active MCP tokens for that user/project scope are revoked if the current MCP
  model can attribute them to the user;
- user then signs in through the normal login form.

Public self-service reset, email delivery, reset-completed email notices, and
internet-facing durable rate limiting are deferred to
`planning/features_v2.0/public-account-recovery/`.

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
- issue a reset/invite link so the user chooses a current password;
- do not silently restore old sessions or tokens.

## Audit

MVP admin actions must write `user_action_log` rows with:

- acting admin user id;
- target user id/email;
- action key;
- request IP/user agent;
- before/after details where useful, excluding secrets and tokens.

If the current `user_action_log` columns are not enough for efficient per-target
admin history, add `target_user_id` / `target_email` columns and indexes rather
than burying every lookup in unindexed JSONB.

Required MVP actions:

- `admin_user_invited`
- `admin_reset_link_generated`
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
  MCP token plaintext in ordinary API responses.
- If a raw invite/reset link is returned for manual delivery, return it only in
  the immediate create response; never persist, re-display, audit, or log it.
- Reject unsafe credentialed requests from untrusted origins. If production
  keeps `SameSite=None`, add minimal CSRF/Origin/custom-header protection for
  admin mutations; preferred production hardening is proving `SameSite=Lax`
  works for `www.ph-nav.com` -> `api.ph-nav.com`.
- Prevent last-admin lockout.
- Enforce last-admin checks transactionally so concurrent demotions/deactivations
  cannot race.
- Generate links from configured canonical frontend base URL, never request
  `Host`.
- Scrub tokens and passwords from logs, audit details, request bodies, and
  frontend error reporting.
- Add backend integration tests for unauthorized, normal-user, admin, inactive
  user, expired token, reused token, CSRF/origin rejection where applicable, and
  last-admin cases.

## Acceptance Criteria

1. An operator can bootstrap Ed's first admin account without setting a reusable
   production password.
2. Ed can invite John from `/admin/users`, John receives a manually delivered
   link, sets a password, and then signs in normally.
3. A normal user cannot load user admin data or call admin endpoints.
4. Admin-generated reset links do not reveal or set temporary passwords.
5. Reset tokens expire and cannot be reused.
6. Completing a password reset invalidates existing sessions.
7. Deactivated users cannot sign in; existing sessions stop working.
8. Last active admin cannot be deactivated or demoted.
9. Sensitive admin actions are written to audit rows.
10. Unsafe admin mutations are rejected without trusted Origin + CSRF/custom
    header protection, or production is verified on `SameSite=Lax`.
11. The production rollout plan is updated so the MVP admin-user-management gate
    no longer includes public reset/email/hardening scope.
12. `make ci` passes, with focused backend/frontend coverage for the MVP flows.
