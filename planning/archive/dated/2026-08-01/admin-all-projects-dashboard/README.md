---
DATE: 2026-08-01
TIME: 11:12 EDT
STATUS: Archived — complete and verified
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Router for the admin all-projects dashboard feature.
RELATED: ./PRD.md, ./decisions.md, ./STATUS.md, ./phases/,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/,
  context/ui/pages/dashboard.md, frontend/src/features/projects/routes/Dashboard.tsx
---

# Admin all-projects dashboard

On the dashboard, a user holding `projects.access.all` sees every non-deleted
project, grouped by owner. Everyone else sees their own projects.

## Read order

1. **`PRD.md`** — behavior contract, response shape, grouping and selection rules.
2. **`decisions.md`** — accepted decisions.
3. **`STATUS.md`** — state, next step, blocker.
4. **`phases/`** — `phase-01` (backend) → `phase-02` (frontend) → `phase-03` (docs).

## Dependency

[`project-ownership-enforcement`](../project-ownership-enforcement/README.md)
is complete and archived beside this packet. This feature uses its
`PROJECT_ACCESS_ALL` capability.

The ordering was not just technical. Before the enforcement dependency, any
signed-in user could read and edit any project by ID, so an admin-only listing
would have been decoration over an open door. Enforcement first made this a
real privilege grant. See that plan's `decisions.md` §D-1.

## Starting point

Most of the auth plumbing already existed:

- `ADMIN_USERS_MANAGE` (`admin.users.manage`) is a real grantable capability
  with a `user_grants` row and an admin UI that manages it.
- `/api/v1/auth/session` already returns the user's resolved `capabilities`
  (`backend/features/auth/routes.py:41`), and the frontend already reads them —
  `canManageUsers(session)` (`frontend/src/features/admin/lib.ts:10`) gates the
  "Users" nav link on this very page (`Dashboard.tsx:108`).
- `ProjectList` is a hand-rolled CSS-grid list, **not** the shared `DataTable`,
  so inserting group headers does not run into the DataTable-uniformity rule.

## Implementation result

- The backend returns a capability-gated, server-ordered all-project list with
  owner fields and `grouped: true`; ordinary responses remain owner-filtered.
- The frontend inserts owner headings/counts without client-side reordering.
- Selection and every destructive dashboard action remain owner-only.
- Backend/frontend suites, live browser acceptance, Graphify, simplify,
  docs-pass, and the full repository CI gate all passed.
