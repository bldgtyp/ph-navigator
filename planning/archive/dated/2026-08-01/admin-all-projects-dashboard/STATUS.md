---
DATE: 2026-08-01
TIME: 11:12 EDT
STATUS: Archived — complete and verified
AUTHOR: Claude (Opus 5) with Ed May
SCOPE: Current state, next step, and blockers for the admin all-projects dashboard.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./phases/,
  planning/archive/dated/2026-08-01/project-ownership-enforcement/STATUS.md
---

# Status

## State

**All three implementation phases are complete and verified.**

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
- Added server-controlled grouped rendering with owner headings and per-owner
  counts.
- Kept deletion owner-only: foreign row controls are disabled with an
  accessible explanation, while select-all operates on owned projects only.
- Verified the grouped dashboard live and captured
  `assets/admin-all-projects-dashboard.png`.
- Folded the grouped-dashboard behavior into the durable Dashboard and Admin
  Users documentation without duplicating the access-model glossary.

## Dependency status

`PROJECT_ACCESS_ALL` and the owner-or-all seam are implemented, verified, and
archived under `planning/archive/dated/2026-08-01/project-ownership-enforcement/`.

The admin-only view now represents a real privilege: ordinary signed-in
non-owners receive `404 project_not_found` at the project seam.

## Next step

No implementation work remains. Deployment remains Ed's decision.

## Verification

Per PRD §7. The two worth not rushing:

- Criterion 2 — non-admin visibility and ordering unchanged. The existing
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

Phase 2 focused verification:

- Focused Vitest (`ProjectList`, `Dashboard`, and `App`) — **36 passed**.
- `make frontend-dev-check` — **passed** (18 pre-existing ESLint warnings,
  zero errors).
- `make ci` — **passed**: backend **1,756 passed / 7 skipped**; frontend
  **2,369 passed**; all required checks green.
- Live grouped-dashboard and owner-only select-all check — **passed**.

Phase 3 closeout verification:

- `simplify` — three parallel reviews complete; documentation findings fixed.
- `docs-pass` — durable Dashboard/Admin Users docs reconciled; glossary reused.
- `make ci` — **passed**: backend **1,756 passed / 7 skipped**; frontend
  **2,369 passed**; format, lint, type, boundary, guard, and build checks green.
