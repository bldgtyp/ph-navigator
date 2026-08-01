---
DATE: 2026-08-01
TIME: 10:41 EDT
STATUS: Active — Phase 1 complete; Phase 2 next
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers for the admin all-projects dashboard.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/STATUS.md
---

# Status

## State

**Phase 1 backend implementation is complete and verified.**

Done 2026-08-01:
- Surveyed the existing auth plumbing; confirmed `ADMIN_USERS_MANAGE`, the
  session `capabilities` payload, and the frontend `canManageUsers` helper all
  already exist and are already used on this page.
- Located the single line that scopes the dashboard
  (`repository.py:33`, `WHERE owner_id = %(owner_id)s`).
- Confirmed `ProjectList` is hand-rolled CSS grid, not the shared `DataTable`,
  so grouping does not collide with the DataTable-uniformity rule.
- D-1..D-4 accepted by Ed.
- Added required `ProjectSummary.owner_id`, optional
  `owner_display_name`, and `ProjectListResponse.grouped` contracts.
- Added the capability-gated all-project listing with own-group-first ordering.
- Kept the existing owner-filter regression untouched and green; added admin
  ordering/grouping coverage and an explicit non-admin `grouped: false` check.

## Dependency status

`PROJECT_ACCESS_ALL` and the owner-or-all seam are implemented and verified.
This feature can begin as stacked work from the implementation branch; merge
the dependency before starting it from `main`.

The admin-only view now represents a real privilege: ordinary signed-in
non-owners receive `404 project_not_found` at the project seam.

## Next step

Start `phases/phase-02-frontend.md`: reconcile the frontend response types,
render owner headings only for grouped responses, and restrict selection to
projects owned by the signed-in user.

## Verification

Per PRD §7. The two worth not rushing:

- Criterion 2 — non-admin output unchanged. The existing
  `test_dashboard_list_is_filtered_to_owner` must pass **untouched**; if it
  needs editing, the change went too far.
- Criterion 4 — disabled checkboxes on non-owned rows. Easy to skip, and its
  absence produces a confusing wall of 404s the first time an admin tries a
  bulk delete.

Phase 1 focused verification:

- `uv run pytest tests/test_projects.py tests/test_access_resolver.py -q` —
  **30 passed**.
- `uv run ty check` — **passed**.
- Focused Ruff format/lint checks — **passed**.

## Estimate

Roughly a day once unblocked: backend ~2h, frontend ~3h, tests + docs ~2h.
