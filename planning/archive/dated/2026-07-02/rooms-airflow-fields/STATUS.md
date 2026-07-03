---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Complete / ready to archive
AUTHOR: Codex
SCOPE: Current state for Rooms default airflow fields.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# STATUS - Rooms Airflow Fields

## State

`Complete` - fresh/stale-upgraded documents expose the two Rooms airflow
built-ins, Rooms renders extra built-in `custom_values` fields through the
shared DataTable number-units path, and closeout verification passed.

## Next Step

Archive under `planning/archive/dated/2026-07-02/rooms-airflow-fields/`.

## Blockers

None.

Phase 02 compatibility decision: use a schema-bump/read-time upgrade. Saved
versions stay immutable unless saved again; stale drafts can be rewritten via
the existing `rewrite_draft_if_upgraded(...)` path. Seed-only is insufficient
because the local dev DB currently has stale saved versions and drafts; a pure
read overlay would make ETag/diff behavior less explicit.

## Verification Ledger

- `graphify query "rooms airflow fields data-change format project document field definitions" --budget 4000`
  returned no useful scoped context.
- Manual code review:
  - `backend/features/project_document/tables/rooms.py`
  - `backend/features/project_document/custom_fields.py`
  - `backend/features/project_document/rows.py`
  - `backend/features/project_document/fielddef_drift.py`
  - `backend/features/project_document/{drafts.py,write_spine.py,store.py}`
  - `frontend/src/lib/units/numberUnits.ts`
  - `frontend/src/shared/ui/data-table/lib/numberDisplay.ts`
- No tests run; docs-only planning pass.
- Phase 00 audit:
  - `graphify query "rooms airflow fields data-change format project document field definitions saved drafts audit diff" --budget 4000`
    returned no useful scoped context.
  - Focused grep/review found no active `data_changes` surface. Current
    persistence/diff/audit surfaces are `project_versions.body`,
    `project_version_drafts.body`, `user_action_log.details`, and
    `ProjectDiffResponse.tables[*].changed_paths`.
  - `NUMBER_UNIT_REGISTRY["airflow"]` already accepts SI `m3_h` and IP `cfm`.
  - `frontend/src/lib/units/numberUnits.ts` already includes airflow display
    units.
  - `backend/seeds/project/rooms.json` stores rows/options only; fresh seed
    bodies receive current code field defs via `seed_dev_db.py`.
  - Local dev DB sample on 2026-07-02: `project_versions=115`,
    `project_version_drafts=19`; latest sampled saved version and latest
    sampled draft both lacked `supply_airflow_m3h` and `extract_airflow_m3h`.
  - Phase 01 added `supply_airflow_m3h` / `extract_airflow_m3h` as nullable
    built-in Rooms number fields with fixed `airflow` units (`m3_h` SI,
    `cfm` IP) in
    `backend/features/project_document/tables/rooms.py`.
  - Phase 01 verification:
    `cd backend && uv run pytest tests/test_project_document.py::test_empty_project_document_has_room_airflow_field_defs tests/test_project_document_fielddef_drift.py::test_fielddef_drift_reports_stale_rooms_airflow_built_ins tests/test_project_document_schema_guard.py::test_project_document_schema_fingerprint_requires_version_guard_update`
    passed on 2026-07-02.
  - Phase 02 bumped `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION` to `2` and added
    `_upgrade_v1_to_v2` in
    `backend/features/project_document/migrations/upgrade.py`.
  - `_upgrade_v1_to_v2` adds missing Rooms airflow built-in FieldDefs while
    preserving existing row `custom_values`, including explicit `null`.
  - Phase 02 refreshed v1 expected schema-fixture snapshots via
    `cd backend && uv run python -m scripts.check_project_document_upgrade --fixtures --fielddef-drift --preview-dir ../working/rooms-airflow-upgrade-preview`;
    the audit reported `fielddef_drift_count: 0`.
  - Phase 02 focused verification:
    `cd backend && uv run pytest tests/test_project_document.py::test_empty_project_document_has_room_airflow_field_defs tests/test_project_document.py::test_project_document_v1_upgrade_adds_rooms_airflow_fields_and_preserves_values tests/test_project_document.py::test_project_document_upgrade_entrypoint_accepts_current_and_v0_baseline tests/test_project_document_fielddef_drift.py::test_fielddef_drift_reports_stale_rooms_airflow_built_ins tests/test_project_document_fielddef_drift.py::test_audit_cli_fielddef_drift_mode_keeps_current_fixtures_clean tests/test_project_document_schema_guard.py::test_project_document_schema_fingerprint_requires_version_guard_update tests/test_project_document_schema_migrations.py tests/test_project_document_upgrade_audit_cli.py::test_project_document_upgrade_audit_reports_fixture_corpus tests/test_project_document_equipment_custom_fields_phase_02.py::test_phase_02_locked_builtin_option_edit_still_rejects_representative_table`
    passed on 2026-07-02.
  - Phase 03 added `frontend/src/features/equipment/__tests__/RoomsTable.airflowFields.test.tsx`
    and updated `RoomsTable` so built-in fields not handled by explicit Rooms
    columns render as custom-value columns before `iCFA`.
  - Phase 03 updated `GridBody` so empty number-with-units cells render blank
    while plain empty number cells keep the existing muted dash.
  - Phase 03 focused verification:
    `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/RoomsTable.airflowFields.test.tsx src/features/equipment/lib.test.ts src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx src/shared/ui/data-table/__tests__/csv.test.ts src/shared/ui/data-table/__tests__/GridBody.test.tsx`
    passed on 2026-07-02.
  - Backend full pytest after schema-fixture cleanup:
    `cd backend && DATABASE_URL="postgresql://phn:phn_local_only@localhost:5433/ph_navigator_v2_test" uv run pytest -x tests`
    passed on 2026-07-02 with `1276 passed, 7 skipped`.
  - `make format` passed on 2026-07-02.
  - `make ci` passed on 2026-07-02:
    - backend pytest: `1276 passed, 7 skipped, 1 warning`.
    - frontend Vitest: `224 passed` test files, `2070 passed` tests.
    - frontend build completed; existing Vite chunk-size warnings remained.
  - `make frontend-dev-check` passed on 2026-07-02 with existing eslint
    warnings and existing Vite chunk-size warnings.
  - In-app Browser smoke on
    `http://localhost:5173/projects/d8ec633a-f1b5-458d-b0db-650778849ace/spaces/rooms`
    using `codex@example.com` passed:
    - page title `PH-Navigator V2`;
    - no blank page or framework/error overlay text;
    - browser console error/warn logs empty;
    - headers rendered `Supply airflow rate cfm` and
      `Extract airflow rate cfm`;
    - blank extract value rendered blank;
    - editing blank supply airflow to `100` in IP mode rendered `100.0`;
    - switching to SI rendered `Supply airflow rate m3/h` and converted
      supply display to `169.9`.
  - `graphify update .` passed on 2026-07-02 and rebuilt
    `graphify-out/graph.json` / `GRAPH_REPORT.md`.
  - Simplify review found no follow-up refactor needed beyond the targeted
    schema-version test fixture cleanup already made.
  - Docs-pass promoted the durable empty number-with-units cell display
    contract into `context/UI_UX.md`.
