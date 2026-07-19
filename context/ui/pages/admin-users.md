> Split from `context/UI_UX.md` §2 (Pages — narrative). Cross-cutting design
> intent (§0), common elements incl. the DataTable model (§1 / §1.7), flows
> (§3), and the state-indicator cheatsheet (§4) stay in `../../UI_UX.md` —
> read it alongside this page.

# 2.13 Admin — Users (`/admin/users`)

**Purpose:** Manage the application's user accounts — invite, reset,
deactivate/reactivate, and grant/revoke the Admin role. An **app-level**
administrative page (`features/admin/routes/AdminUsersPage.tsx`), **not** a
per-project workspace tab.

## Access gating

Capability-gated on `admin.users.manage` (`canManageUsers`). The Dashboard
topbar only shows a "Users" nav link to holders of that capability, and the
page itself renders a "Not authorized" `ShellMessage` for anyone who reaches
the route without it (also handling a backend 403). The route is app-scoped,
so it uses the plain `WorkspaceTopbar` (breadcrumb "Users") rather than a
project header.

## Layout

- Heading "Users" with a primary **Invite user** button.
- `AdminUsersTable` — one row per user showing name, email, status
  (Active / Invited / Inactive), and role (User / Admin), with a per-row
  action set.

## Actions (all modal-driven)

- **Invite user** (`InviteUserModal`) → issues a one-time invite link,
  surfaced in `OneTimeLinkModal` for the admin to copy.
- **Change name / email** (`EditUserFieldModal`).
- **Reset link** — issues a one-time password-reset link
  (`useResetLinkMutation`), shown via `OneTimeLinkModal`.
- **Deactivate** (`ConfirmActionModal`) — revokes the user's sessions and
  tokens immediately.
- **Reactivate** (`ConfirmActionModal`) — re-enables the user and issues a
  fresh one-time link so they can set a password.
- **Grant / Revoke Admin** (`ConfirmActionModal`) — toggles the Admin role
  (`admin.users.manage`) via `useSetUserAdminMutation`.
- **View audit** (`UserAuditModal`) — the user's admin-action history.

One-time links (invite / reset / reactivate) are always shown once in a copy
modal rather than emailed from the app; the admin relays them.
