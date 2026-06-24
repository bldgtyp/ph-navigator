---
DATE: 2026-06-24
TIME: 00:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Methodical implementation plan for the DataTable built-in status field.
RELATED: planning/archive/data-table-status-field/PRD.md, planning/archive/data-table-status-field/STATUS.md
---

# Plan - DataTable Status Field

## Phase 01 - Contract And Seeds

1. Add a shared backend status FieldDef / option helper instead of duplicating raw option literals across table modules.
2. Append `status` as a built-in `single_select` FieldDef to each in-scope shared table module.
3. Append `status` to Heat Pump Outdoor Equipment and Indoor Equipment built-in FieldDefs only.
4. Add namespaced status option lists to `empty_project_document()` and to all relevant `backend/seeds/project/*.json` files.
5. Add `custom_values.status` to seeded rows, intentionally distributing `Complete`, `Needed`, `Question`, and `N/A`.

## Phase 02 - Backend Validation And Tests

1. Update per-table option models / option-key sets so `*.status` lists round-trip and validate.
2. Update Heat Pump visible / leaf option-key wiring so Outdoor Equipment and Indoor Equipment slices expose their status option lists.
3. Add or extend backend tests for at least:
   - `test_project_document_thermal_bridges.py`
   - `test_project_document_pumps.py`
   - `test_project_document_fans.py`
   - `test_project_document_hot_water_heaters.py`
   - `test_project_document_hot_water_tanks.py`
   - `test_project_document_electric_heaters.py`
   - `test_project_document_appliances.py`
   - `backend/tests/features/heat_pumps/test_heat_pumps.py`
   - `test_seed_dev_db.py`
4. Verify unknown status option ids fail the existing single-select validation path.

## Phase 03 - Frontend Types, Defaults, And UI

1. Add a shared frontend status option/key helper for the target table names.
2. Update TypeScript option-map types where they are currently exact records so namespaced `*.status` keys type-check.
3. Update compatibility field-def fallbacks in `frontend/src/features/equipment/lib.ts` and Heat Pump field-def fallbacks if needed.
4. Ensure row builders carry the `fieldDefaults.status` value into `custom_values.status`.
5. Reuse shared DataTable single-select rendering; only add a small visual mapping if `Status` should use Materials-style dot colors instead of generic single-select pill colors.
6. Add focused frontend tests for shared equipment tables and Heat Pump equipment leaves that assert the `Status` column renders and edits through the shared cell path.

## Phase 04 - Local Reset, Reseed, And Smoke

1. Run focused checks first:
   - `cd backend && uv run pytest backend/tests/test_project_document_pumps.py backend/tests/test_project_document_thermal_bridges.py backend/tests/features/heat_pumps/test_heat_pumps.py`
   - `cd frontend && pnpm exec vitest run frontend/src/features/equipment/lib.test.ts frontend/src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts`
2. Run repo development checks:
   - `make check-backend`
   - `make frontend-dev-check`
3. Reset and reseed local dev DB using the repo pipeline:
   - `make db-reset-dev`
   - `make seed-agent-user`
   - `cd backend && uv run python -m scripts.check_db`
4. Browser smoke on `http://localhost:5173` signed in as `codex@example.com`:
   - Open Thermal Bridges and each target Equipment tab.
   - Confirm `Status` appears as a single-select field.
   - Edit one row through Complete / Needed / Question / N/A.
   - Reload and confirm persistence.

## Phase 05 - Closeout

1. Run `graphify update .` after code changes.
2. Run the requested closeout checks for this repo stage.
3. Update this packet's `STATUS.md` and phase ledger with exact commands and outcomes.
4. Fold any durable DataTable status-field contract into `context/technical-requirements/data-table.md` if the implementation establishes reusable rules.

## Implementation Notes

- Prefer one shared helper for status options to avoid nine copies drifting.
- Keep option ids identical across table-specific option lists; namespace is carried by the map key, not by the option id.
- For shared tables, `useTableSchema()` can resolve namespaced option lists (`${tableKey}.status`) into the local `status` FieldDef. Keep that contract instead of introducing table-local render logic.
- For row creation, the shared DataTable computes `fieldDefaults` from FieldDefs, then each feature `buildEmpty*Row` moves those defaults into typed fields or `custom_values`. `status` must ride that existing default path.
- Existing persisted projects will not receive this built-in field unless a migration/backfill is added. Because the request includes reset/reseed of the local dev DB, Phase 01 can target new/seeded documents first. If current non-dev documents must be upgraded, add a separate migration/backfill task before implementation.
- Heat Pump aggregate response currently differs from the leaf table responses. Confirm whether any code path still consumes aggregate Heat Pumps rows for editing before deciding whether aggregate response types need status options.
