---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Verification, browser smoke, documentation updates, and closeout for Equipment Custom Fields.
RELATED: planning/features/equipment-custom-fields/README.md; planning/features/equipment-custom-fields/STATUS.md; planning/features/equipment-custom-fields/phases/phase-01-backend-registry-pilot.md; planning/features/equipment-custom-fields/phases/phase-02-backend-registry-rollout.md; planning/features/equipment-custom-fields/phases/phase-03-frontend-affordance-wiring.md
---

# Phase 04 - Verification and Closeout

## Goal

Prove the full feature works end to end, update durable feature status,
and leave the branch ready for review or merge.

## Preconditions

- Phase 01, Phase 02, and Phase 03 are complete.
- Focused backend and frontend tests are already passing.

## Focused Verification

Run focused tests first so failures point to the phase that caused them:

1. [x] Backend schema-mutation tests for project-document custom fields and
   target table contracts.
2. [x] Backend tests covering equipment payload builders, attachments, and
   record-linking if touched by the implementation.
3. [x] Frontend rendered tests for Rooms custom fields plus the new target
   table coverage.
4. [x] E2E or Playwright smoke only if the rendered tests cannot prove the
   real add-field workflow.

## Browser Smoke

Use the repo-wide local UI baseline:

- frontend `http://localhost:5173`
- backend `http://localhost:8000`
- login `codex@example.com` / `password`

Before browser work:

```bash
curl -i http://localhost:8000/api/v1/auth/session
```

Expected signed-out health response is `401` with
`not_authenticated`.

Smoke at least:

- [x] Pumps: add a short-text field, enter a value, refetch/reload, confirm
  the field and value persist.
- [x] Ventilators or Fans: confirm the tail button and dialog work on a
  non-Pumps Equipment table.
- [x] Thermal Bridges: confirm the tail button and dialog work while the
  PDF report field still renders normally.
- [x] Viewer or locked-version state: confirm schema mutation controls are
  absent.

## Repo Gate

Close with the mandatory gate from the project guide:

```bash
make format
make ci
```

If `make format` changes files, inspect the diff and rerun `make ci`.
Do not mark the feature complete while `make ci` is red.

After code changes, run:

```bash
graphify update .
```

## Documentation Closeout

Update `STATUS.md` with:

- completed phases
- focused test commands and results
- browser smoke notes, if run
- final `make format` / `make ci` result
- any deferred table or field-type limitations

If implementation creates reusable guidance beyond this feature, promote
that lesson to `planning/features/.instructions.md`, `context/`, or
`AGENTS.md` depending on scope.

## Acceptance Criteria

- [x] All target tables support custom-field authoring in editor mode.
- [x] Viewer / locked states do not expose schema mutation controls.
- [x] Backend and frontend focused tests pass.
- [x] `make format` and `make ci` pass.
- [x] `STATUS.md` accurately records the final state and evidence.

## Completion Evidence

- `cd backend && uv run pytest tests/test_project_document_equipment_custom_fields_phase_02.py tests/test_project_document_pumps.py tests/test_project_document_ventilators.py tests/test_project_document_fans.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_thermal_bridges.py tests/test_project_document_schema_mutation_endpoint.py` - passed, 63 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx src/features/equipment/__tests__/RoomsTable.addField.test.tsx src/features/equipment/__tests__/RoomsTable.customField.test.tsx src/features/equipment/__tests__/RoomsTable.formulaField.test.tsx src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/features/equipment/__tests__/VentilatorsTable.reuse.test.tsx src/features/equipment/__tests__/FansTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterHeatersTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterTanksTable.reuse.test.tsx src/features/equipment/__tests__/ElectricHeatersTable.reuse.test.tsx src/features/equipment/__tests__/AppliancesTable.reuse.test.tsx` - passed, 13 files / 61 tests.
- Browser smoke used local `http://localhost:5173` / `http://localhost:8000` with `codex@example.com`; project `2aacd8ab-3c07-4c71-9a3e-10b33eb186c8` passed:
  - Ventilators created a short-text custom field through the Add field dialog.
  - Pumps created a short-text custom field through the Add field dialog, added a row through the UI, and persisted a custom value in the draft table.
  - Thermal Bridges created a short-text custom field through the Add field dialog while the report PDF field was still rendered.
  - Locked version state showed zero active `Add field` buttons.
- Local browser setup required recreating only the local `ph_navigator_v2` dev database after Alembic reported stale local revision `20260613_0025`; backend was restarted once to clear stale psycopg connections from the forced local DB recreation.
- `$simplify` pass fixed the formula-field closeout gap: all target backend table responses now emit `rows_computed`, the frontend target table components pass that overlay to `customFieldColumnDefs`, and focused regression coverage proves Formula fields render computed values instead of blank cells.
- `cd backend && uv run pytest tests/test_project_document_equipment_custom_fields_phase_02.py` - passed, 26 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx` - passed, 20 tests.
- `make format` - passed; no files changed.
- `make ci` - passed after recreating only the stale local `ph_navigator_v2_test` database. Backend `804 passed, 2 skipped, 1 warning`; frontend lint kept 3 existing fast-refresh warnings, Vitest `161 passed` files / `1595 passed` tests, production build passed with existing chunk-size warning.
- `graphify update .` - passed; rebuilt `graphify-out/graph.json` and `GRAPH_REPORT.md`, skipped HTML because the graph has 10,717 nodes.

## Stop Condition

Stopped after verification evidence, final repo gate, and graphify update
were recorded. The phase is ready for review on the feature PR.
