STATUS: Review of TB-07 (Catalog Manager Tracer) uncommitted changes.
DATE: 2026-05-14
REVIEWER: Codex

# TB-07 Code Review - Catalog Manager Tracer

## Scope Reviewed

Reviewed the current uncommitted diff against the TB-07 roadmap scope, not against the final app. TB-07 is scoped to one managed catalog that downstream pickers can read:

- relational schema for the first catalog row type;
- list/create/edit/deactivate API;
- dashboard/header Catalogs entry and material catalog table UI;
- `catalog_schema_version: 1` hook only, with catalog-schema migration tooling deferred;
- tests for validation, active/inactive filtering, bookshelf-copy metadata, and no live project mutation.

Primary references:

- `docs/plans/01_IMPLEMENTATION-ROADMAP.md` TB-07
- `context/technical-requirements/data-model.md` §7
- `context/user-stories/50-settings-ops-llm.md` US-OPS-1 audit log rows
- `context/user-stories/10-windows.md` downstream picker shape

## Findings

### H1. Catalog create/update/delete actions bypass the v1 audit log

**Files:** `backend/features/catalogs/service.py`, `backend/features/catalogs/routes.py`, `backend/tests/test_catalogs.py`

Catalog writes mutate a global firm library but do not write `user_action_log` entries. `context/user-stories/50-settings-ops-llm.md` includes catalog edit events in v1 scope: `catalog_record_create`, `_update`, `_version_create`, `_delete` with `catalog_table`, `record_id`, and `version_id` metadata. `context/technical-requirements/data-model.md` §7.3 also states catalog edits are audit-logged.

Current implementation:

- creates rows in `create_material()` without calling `auth_repository.log_action()`;
- updates current-version fields in `update_material()` without logging;
- soft-deletes/reactivates in `deactivate_material()` / `reactivate_material()` without logging;
- has no regression test asserting catalog audit rows.

This is more than administrative polish because TB-07 introduces the first global mutable data surface. A bad edit can affect future project picks across BLDGTYP projects, and the current code loses the "who changed what when" trail that already exists for auth, projects, MCP tokens, and project-document version actions.

Recommended fix:

- Pass `Request` into write routes or add a small catalog audit helper parallel to `features/project_document/audit.py`.
- Log `catalog_record_create`, `catalog_record_update`, `catalog_record_delete`, and either `catalog_record_reactivate` or a documented `_update` detail for reactivation.
- Include at least `catalog_table: "materials"`, `record_id`, `version_id`, and changed field keys for updates.
- Add a backend test that create/update/delete rows appear in `user_action_log`.

### M1. Clearing `version_date` on edit can produce a database 500

**Files:** `frontend/src/features/catalogs/components/MaterialEditorModal.tsx`, `backend/features/catalogs/service.py`, `backend/features/catalogs/repository.py`, `backend/alembic/versions/20260514_0007_catalog_materials.py`

The edit modal allows the `type="date"` input to be cleared. `toCreatePayload()` then sends `version_date: null`. On create, `create_material()` handles this with `payload.version_date or date.today()`. On update, `update_material()` forwards `None` into `repository.update_material()`, which builds `UPDATE catalog_material_versions SET version_date = NULL ...`.

The migration declares `catalog_material_versions.version_date` as `nullable=False`, so this path should raise a database integrity error and return a server error instead of a controlled validation response. This is visible from:

- modal payload conversion: `MaterialEditorModal.tsx` lines 63-76;
- create default only: `service.py` lines 47-50;
- update forwarding: `service.py` lines 75-91 and `repository.py` lines 162-173;
- NOT NULL column: migration lines 45-46.

Recommended fix:

- If `version_date` is required for edits, make the frontend date input `required` and reject `None` in `CatalogMaterialUpdateRequest`.
- If clearing should mean "today" or "unchanged", encode that explicitly in the backend before repository update.
- Add a backend test for `PATCH /api/v1/catalogs/materials/{id}` with `"version_date": null`.

## Scope Fit

TB-07 is otherwise directionally aligned with the roadmap:

- Materials is a reasonable tracer catalog and matches the roadmap's "smallest typed field set" lesson.
- Identity row plus current version row matches the bookshelf model and keeps project documents detached from live catalog mutation.
- `catalog_schema_version: 1` is present in the version row and public response.
- Inactive filtering and direct inactive row reads preserve the historical-pick path.
- The frontend intentionally uses a plain catalog table rather than the project-document `<DataTable>`, which matches the TB-07 lesson because catalog rows are not draft-scoped.

## Explicit Non-Issues / Deferred Items

These are not TB-07 blockers:

- No frame/glazing catalog implementation yet. TB-07 is the first catalog row type only.
- No new-version flow. The roadmap explicitly allows in-place current-version patching and defers new-version UI.
- No catalog-schema migration tooling. TB-07 requires only the `catalog_schema_version: 1` hook.
- No project picker integration. TB-08 owns downstream window-type picking.
- No project-document draft mutation from catalog edits. The tests correctly cover this bookshelf invariant.

## Verification Run

- `cd backend && uv run pytest tests/test_catalogs.py` - passed, 6 tests.
- `cd frontend && npm test -- --run src/features/catalogs/query-keys.test.ts src/App.test.tsx` - passed, 22 tests.

Initial backend test invocation used a repo-relative path after `cd backend`, so pytest found no file; rerun above used the correct backend-relative path.
