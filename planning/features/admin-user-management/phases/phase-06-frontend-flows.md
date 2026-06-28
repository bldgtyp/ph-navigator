---
DATE: 2026-06-27
TIME: 19:59 EDT
STATUS: Planned
AUTHOR: Codex (for Ed May)
SCOPE: Admin dashboard and invite/reset frontend user flows.
RELATED:
  - ../PRD.md
  - frontend/src/app/router.tsx
  - frontend/src/features/auth/
  - context/UI_UX.md
---

# Phase 06 - Frontend Flows

## Goal

Add the admin user-management UI and account-token completion pages without
turning frontend route guards into the source of truth.

## Implementation Tasks

1. Session/capability affordances:
   - consume backend capability/session data;
   - show admin nav only when `admin.users.manage` is present;
   - handle 403 with a plain not-authorized shell.
2. Admin route:
   - `/admin/users`;
   - user table with search/filter by status/role;
   - columns for name, email, status, role preset, `is_staff`, created, last
     login, active session count, recent admin action.
3. Modals/actions:
   - invite user;
   - resend invite;
   - trigger reset;
   - deactivate/reactivate;
   - grant/revoke Admin and Catalog Admin if in scope;
   - toggle `is_staff` if in scope;
   - fresh admin re-auth prompt for sensitive actions.
4. Audit drawer:
   - recent admin/user lifecycle events for a selected user;
   - no token/session ids or secrets.
5. Public pages:
   - forgot-password request page/state on sign-in;
   - reset complete page;
   - invite complete page;
   - token extracted from URL fragment/query and sent only in POST body.
6. UI copy:
   - generic reset request confirmation;
   - explicit destructive confirmations for deactivate/admin revoke;
   - no visible implementation/security instruction text beyond normal product
     copy.

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

- Ed can perform every blocking account lifecycle action through the UI.
- Normal users cannot see or use admin affordances.
- Frontend never displays raw reset/invite tokens after form submission.
