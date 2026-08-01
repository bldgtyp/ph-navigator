---
DATE: 2026-08-01
TIME: 09:58 EDT
STATUS: Ready — ownership dependency implemented and verified
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers for the admin all-projects dashboard.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/STATUS.md
---

# Status

## State

**Planned and ready. No feature code written.**

Done 2026-08-01:
- Surveyed the existing auth plumbing; confirmed `ADMIN_USERS_MANAGE`, the
  session `capabilities` payload, and the frontend `canManageUsers` helper all
  already exist and are already used on this page.
- Located the single line that scopes the dashboard
  (`repository.py:33`, `WHERE owner_id = %(owner_id)s`).
- Confirmed `ProjectList` is hand-rolled CSS grid, not the shared `DataTable`,
  so grouping does not collide with the DataTable-uniformity rule.
- D-1..D-4 accepted by Ed.

## Dependency status

`PROJECT_ACCESS_ALL` and the owner-or-all seam are implemented and verified.
This feature can begin as stacked work from the implementation branch; merge
the dependency before starting it from `main`.

The admin-only view now represents a real privilege: ordinary signed-in
non-owners receive `404 project_not_found` at the project seam.

## Next step

Start `phases/phase-01-backend.md` with §1.3 — enumerate
every `ProjectSummary` construction site before touching the model. That is the
one step in this feature with real breakage potential.

## Verification

Per PRD §7. The two worth not rushing:

- Criterion 2 — non-admin output unchanged. The existing
  `test_dashboard_list_is_filtered_to_owner` must pass **untouched**; if it
  needs editing, the change went too far.
- Criterion 4 — disabled checkboxes on non-owned rows. Easy to skip, and its
  absence produces a confusing wall of 404s the first time an admin tries a
  bulk delete.

## Estimate

Roughly a day once unblocked: backend ~2h, frontend ~3h, tests + docs ~2h.
