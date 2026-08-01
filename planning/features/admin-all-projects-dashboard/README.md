---
DATE: 2026-08-01
TIME: 08:25 EDT
STATUS: Ready — ownership dependency implemented and verified
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Router for the admin all-projects dashboard feature.
RELATED: ./PRD.md, ./decisions.md, ./STATUS.md, ./phases/,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/,
  context/ui/pages/dashboard.md, frontend/src/features/projects/routes/Dashboard.tsx
---

# Admin all-projects dashboard

On the dashboard, a user holding the Admin preset sees **every** project,
grouped by owner. Everyone else sees exactly what they see today: their own.

## Read order

1. **`PRD.md`** — behavior contract, response shape, grouping and selection rules.
2. **`decisions.md`** — accepted decisions.
3. **`STATUS.md`** — state, next step, blocker.
4. **`phases/`** — `phase-01` (backend) → `phase-02` (frontend) → `phase-03` (docs).

## Dependency

[`project-ownership-enforcement`](../../archive/dated/2026-08-01/project-ownership-enforcement/README.md)
Phase 2 is implemented and verified on the branch that introduces this packet.
Merge them together before starting this feature from `main`. This feature
gates on the refactor's `PROJECT_ACCESS_ALL` capability.

The ordering is not just technical. Today *any* signed-in user can read and edit
*any* project by ID — so an admin-only listing would be decoration over an open
door. Enforcement first makes this a real privilege grant. See that plan's
`decisions.md` §D-1.

## What already exists

Most of the auth plumbing is done:

- `ADMIN_USERS_MANAGE` (`admin.users.manage`) is a real grantable capability
  with a `user_grants` row and an admin UI that manages it.
- `/api/v1/auth/session` already returns the user's resolved `capabilities`
  (`backend/features/auth/routes.py:41`), and the frontend already reads them —
  `canManageUsers(session)` (`frontend/src/features/admin/lib.ts:10`) gates the
  "Users" nav link on this very page (`Dashboard.tsx:108`).
- `ProjectList` is a hand-rolled CSS-grid list, **not** the shared `DataTable`,
  so inserting group headers does not run into the DataTable-uniformity rule.

## What is actually missing

1. `repository.list_projects_for_owner` hard-filters `WHERE owner_id`
   (`backend/features/projects/repository.py:33`) — the single line that scopes
   the dashboard.
2. `ProjectSummary` carries no owner fields, so the client cannot group.
3. `ProjectList` renders one flat list with no group affordance.

Three small changes. The whole feature is roughly a day.
