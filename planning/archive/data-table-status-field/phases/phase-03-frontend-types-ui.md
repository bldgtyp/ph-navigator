---
DATE: 2026-06-24
TIME: 09:25 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Frontend DataTable type, default-row, payload, and UI plan for the status field.
RELATED: planning/archive/data-table-status-field/PLAN.md, planning/archive/data-table-status-field/phases/phase-02-backend-validation-tests.md
---

# Phase 03 - Frontend Types And UI

> **Outcome (2026-06-24):** Implemented. `status` is exposed as an editable
> DataTable single-select column on all nine in-scope tables via the shared
> machinery — no per-table cell fork. Status constants
> (`STATUS_FIELD_KEY`, `STATUS_DEFAULT_OPTION_ID`, the nine `<table>.status`
> keys) live in `equipment/types.ts`; the shared tables resolve the column
> through `useTableSchema`'s existing `${tableKey}.${field_key}` mapping +
> a shared `lib/statusColumn.ts` accessor (reads `custom_values.status`).
> The two Heat Pump equipment leaves build FieldDefs from local factories,
> so they use a parallel `heat-pumps/status-column.ts` + a `status →
> setCustomValue` cell-write seam (status lives in `custom_values`, not a
> typed column). New rows default to `opt_status_needed`; duplicate
> preserves the source status. Row builders carry `fieldDefaults.status`;
> `clone*Options` preserve the status list. The Status pill already shows
> the Materials palette via the four option colors, so **no bespoke
> Materials-dot renderer was needed** (resolves the open question). Tests:
> shared `status_field_helpers`-style fixtures + ~17 added/updated frontend
> tests (built-in shape, schema resolution, new-row default, cell
> round-trip, duplicate preservation, render assertions). A colliding
> custom "Status" field in the phase-03 custom-field test was renamed to
> "Reviewer". **`make frontend-dev-check` green; full vitest 1887 passed.**

## Objective

Expose the backend `status` FieldDef as a normal editable DataTable single-select column, while preserving the shared DataTable path for filtering, sorting, grouping, CSV, row detail, copy/paste, row insert, and row duplicate.

## Type And Schema Tasks

- [x] Add shared frontend constants for:
  - `STATUS_FIELD_KEY = "status"`
  - `STATUS_DEFAULT_OPTION_ID = "opt_status_needed"`
  - table-specific status option keys, e.g. `pumps.status`, `heat_pumps_outdoor_equip.status`
- [x] Update exact option-map types in `frontend/src/features/equipment/types.ts` so each in-scope table accepts custom/namespaced status option lists.
- [x] Update Heat Pump option types in `frontend/src/features/equipment/heat-pumps/types.ts` so Outdoor Equipment and Indoor Equipment leaf slices accept `*.status` option lists.
- [x] Verify `useTableSchema()` resolves `${tableKey}.status` into the local `status` FieldDef without a special-case adapter.
- [x] Update compatibility FieldDef fallbacks in `frontend/src/features/equipment/lib.ts` and Heat Pump field-def fallbacks only where they still exist for stale/pre-seed payloads.

## Row Builder And Payload Tasks

- [x] Update shared Equipment row builders so `fieldDefaults.status` lands in `custom_values.status`:
  - `buildEmptyPumpRow.ts`
  - `buildEmptyFanRow.ts`
  - `buildEmptyHotWaterHeaterRow.ts`
  - `buildEmptyHotWaterTankRow.ts`
  - `buildEmptyElectricHeaterRow.ts`
  - `buildEmptyApplianceRow.ts`
- [x] Add or update the Thermal Bridges row builder / payload path if its table uses a separate frontend feature module.
- [x] Update Heat Pump row builders so Outdoor Equipment and Indoor Equipment carry `custom_values.status`; leave Outdoor Units and Indoor Units untouched.
- [x] Ensure payload builders preserve status options when cloning/replacing option maps:
  - shared Equipment helpers in `frontend/src/features/equipment/lib.ts`
  - Heat Pump helpers in `frontend/src/features/equipment/heat-pumps/payload-builders.ts`
- [x] Confirm duplicate-row helpers copy or reset status intentionally. Recommended default: duplicate preserves source row status because it is an ordinary field value; insert-new-row uses `opt_status_needed`.

## UI Tasks

- [x] Let shared `SingleSelectCell` render the `Status` field first.
- [x] If a visual status cue is required now, add the smallest shared mapping from status option ids to existing report-status colors; do not fork every table component.
- [x] Confirm the `Status` field appears in hide-fields, filter, sort, group, row-detail, and CSV surfaces through existing DataTable machinery.
- [x] Avoid adding table-local renderers unless shared `SingleSelectCell` cannot meet the Materials-style status visual requirement.

## Test Tasks

- [x] Extend `frontend/src/features/equipment/lib.test.ts` to cover row insert defaults and payload option preservation for the shared equipment tables.
- [x] Extend Heat Pump tests:
  - `frontend/src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts`
  - `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
  - Outdoor/Indoor equipment table tests if the rendered column assertion belongs there.
- [x] Add one shared DataTable assertion, if needed, that a built-in single-select default appears as an editable cell.
- [x] Add fixture updates under `frontend/src/features/equipment/testing/*.ts` so table tests include the status FieldDef and status option list.

## Suggested Focused Checks

```sh
cd frontend && pnpm exec vitest run \
  src/features/equipment/lib.test.ts \
  src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts \
  src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx
```

Then run:

```sh
make frontend-dev-check
```

## Completion Criteria

- The frontend type-checks with status option lists on all in-scope table payloads.
- New rows default to `Needed`.
- Existing rows can edit `Status` through the shared single-select cell path.
- No Heat Pump unit-instance table receives the status field.
- Focused frontend tests pass.
