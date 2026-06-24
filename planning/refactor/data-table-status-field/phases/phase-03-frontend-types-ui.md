---
DATE: 2026-06-24
TIME: 00:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Frontend DataTable type, default-row, payload, and UI plan for the status field.
RELATED: planning/refactor/data-table-status-field/PLAN.md, planning/refactor/data-table-status-field/phases/phase-02-backend-validation-tests.md
---

# Phase 03 - Frontend Types And UI

## Objective

Expose the backend `status` FieldDef as a normal editable DataTable single-select column, while preserving the shared DataTable path for filtering, sorting, grouping, CSV, row detail, copy/paste, row insert, and row duplicate.

## Type And Schema Tasks

- [ ] Add shared frontend constants for:
  - `STATUS_FIELD_KEY = "status"`
  - `STATUS_DEFAULT_OPTION_ID = "opt_status_needed"`
  - table-specific status option keys, e.g. `pumps.status`, `heat_pumps_outdoor_equip.status`
- [ ] Update exact option-map types in `frontend/src/features/equipment/types.ts` so each in-scope table accepts custom/namespaced status option lists.
- [ ] Update Heat Pump option types in `frontend/src/features/equipment/heat-pumps/types.ts` so Outdoor Equipment and Indoor Equipment leaf slices accept `*.status` option lists.
- [ ] Verify `useTableSchema()` resolves `${tableKey}.status` into the local `status` FieldDef without a special-case adapter.
- [ ] Update compatibility FieldDef fallbacks in `frontend/src/features/equipment/lib.ts` and Heat Pump field-def fallbacks only where they still exist for stale/pre-seed payloads.

## Row Builder And Payload Tasks

- [ ] Update shared Equipment row builders so `fieldDefaults.status` lands in `custom_values.status`:
  - `buildEmptyPumpRow.ts`
  - `buildEmptyFanRow.ts`
  - `buildEmptyHotWaterHeaterRow.ts`
  - `buildEmptyHotWaterTankRow.ts`
  - `buildEmptyElectricHeaterRow.ts`
  - `buildEmptyApplianceRow.ts`
- [ ] Add or update the Thermal Bridges row builder / payload path if its table uses a separate frontend feature module.
- [ ] Update Heat Pump row builders so Outdoor Equipment and Indoor Equipment carry `custom_values.status`; leave Outdoor Units and Indoor Units untouched.
- [ ] Ensure payload builders preserve status options when cloning/replacing option maps:
  - shared Equipment helpers in `frontend/src/features/equipment/lib.ts`
  - Heat Pump helpers in `frontend/src/features/equipment/heat-pumps/payload-builders.ts`
- [ ] Confirm duplicate-row helpers copy or reset status intentionally. Recommended default: duplicate preserves source row status because it is an ordinary field value; insert-new-row uses `opt_status_needed`.

## UI Tasks

- [ ] Let shared `SingleSelectCell` render the `Status` field first.
- [ ] If a visual status cue is required now, add the smallest shared mapping from status option ids to existing report-status colors; do not fork every table component.
- [ ] Confirm the `Status` field appears in hide-fields, filter, sort, group, row-detail, and CSV surfaces through existing DataTable machinery.
- [ ] Avoid adding table-local renderers unless shared `SingleSelectCell` cannot meet the Materials-style status visual requirement.

## Test Tasks

- [ ] Extend `frontend/src/features/equipment/lib.test.ts` to cover row insert defaults and payload option preservation for the shared equipment tables.
- [ ] Extend Heat Pump tests:
  - `frontend/src/features/equipment/heat-pumps/__tests__/payload-builders.test.ts`
  - `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
  - Outdoor/Indoor equipment table tests if the rendered column assertion belongs there.
- [ ] Add one shared DataTable assertion, if needed, that a built-in single-select default appears as an editable cell.
- [ ] Add fixture updates under `frontend/src/features/equipment/testing/*.ts` so table tests include the status FieldDef and status option list.

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
