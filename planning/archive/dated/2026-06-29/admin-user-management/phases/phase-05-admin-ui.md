---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Complete
AUTHOR: Codex (for Ed May)
SCOPE: Minimal admin dashboard and invite/reset-link frontend flows.
RELATED:
  - ../PRD.md
  - frontend/src/app/router.tsx
  - frontend/src/features/auth/
  - context/UI_UX.md
---

# Phase 05 - Admin UI

## Goal

Add the minimal MVP admin user-management UI and account-token completion pages
without turning frontend route guards into the source of truth.

## Implementation Tasks

1. Session/capability affordances:
   - consume backend capability/session data;
   - show admin nav only when `admin.users.manage` is present;
   - handle 403 with a plain not-authorized shell.
2. Admin route:
   - `/admin/users`;
   - compact user table with search/filter by status/role;
   - columns for name, email, status, Admin yes/no, created, recent action if
     available.
3. MVP modals/actions:
   - invite user;
   - generate reset link;
   - deactivate/reactivate;
   - grant/revoke Admin;
   - one-time link presentation with clear copy affordance and no persistence.
4. Minimal audit view:
   - recent lifecycle events for a selected user, or a clear documented SQL
     fallback if the UI is not worth the MVP surface;
   - no token/session ids or secrets.
5. Public token pages:
   - reset-complete page;
   - invite-complete page;
   - token extracted from URL fragment/query and sent only in POST body.

Deferred:

- forgot-password request page;
- transactional email status;
- fresh admin re-auth prompt;
- separate `Catalog Admin` and `is_staff` controls;
- full audit drawer/export.

## Verification

- Frontend unit/component tests for route guard, table, modals, and forms.
- Browser smoke:
  - admin loads `/admin/users`;
  - normal user sees 403/not authorized;
  - invite link completion;
  - reset link completion;
  - deactivate/reactivate interaction.
- `make frontend-dev-check` during UI iteration; `make ci` at phase close.

## Exit Criteria

- Ed can perform every MVP account lifecycle action through the UI.
- Normal users cannot see or use admin affordances.
- Frontend never displays raw reset/invite tokens after the one-time create
  response is dismissed.

## Outcome (2026-06-27)

New `frontend/src/features/admin/` feature + the public completion page:

- `AuthSession` gained `capabilities`; `canManageUsers(session)` gates the
  "Users" nav link on the Dashboard topbar and the `/admin/users` page itself
  (non-admins get a plain "Not authorized" shell, and the API still 403s).
- `routes/AdminUsersPage.tsx` — compact table (name/email/status/role/created/
  last-action) with a per-row action menu, driven by TanStack Query hooks.
- Modals: `InviteUserModal` (email/display name/role), `ConfirmActionModal`
  (deactivate/reactivate/grant/revoke — generic, parent owns the mutation),
  `UserAuditModal` (recent activity, no secrets), and `OneTimeLinkModal` which
  shows the raw invite/reset/reactivation link **once** with a copy button and
  no persistence (state cleared on dismiss).
- Public `auth/routes/AccountCompletePage.tsx` (`/invite`, `/reset`) reads the
  token from the URL **fragment**, validates length + match client-side, POSTs
  to the completion endpoints, and on success points the user at sign-in.
- Styling reuses shared button/modal/form recipes; only `admin.css` (layout,
  table, status/role chips) is feature-specific, on the 3-tier tokens.
- Tests: `admin/__tests__/lib.test.ts` (capability gate + labels),
  `admin/__tests__/AdminUsersTable.test.tsx` (chips + status-specific actions),
  `auth/routes/__tests__/AccountCompletePage.test.tsx` (missing token, mismatch
  guard, token-from-fragment POST + success). Browser smoke deferred to Phase 06
  (the rehearsal step) since the extension is unpaired this session.
