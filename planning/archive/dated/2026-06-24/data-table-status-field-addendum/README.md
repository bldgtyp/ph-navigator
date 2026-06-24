---
DATE: 2026-06-24
TIME: 11:30 EDT
STATUS: Complete
AUTHOR: Claude
SCOPE: Addendum to the DataTable Status Field refactor — extend the built-in `status` single-select to the three remaining Datasheet-bearing tables (Ventilators, Heat-Pump Outdoor Units, Heat-Pump Indoor Units) that the original packet explicitly deferred.
RELATED: planning/archive/data-table-status-field/README.md, planning/archive/data-table-status-field-addendum/PRD.md, planning/archive/data-table-status-field-addendum/PLAN.md, planning/archive/data-table-status-field-addendum/STATUS.md
---

# DataTable Status Field — Addendum (Datasheet-Bearing Tables)

## Why this packet exists

The completed [DataTable Status Field](../../archive/data-table-status-field/README.md)
refactor added a built-in `status` single-select to **nine** tables, but it
explicitly listed three tables as **Non-Goals**:

> Do not add `status` to … Ventilators … or Heat Pump unit-instance tables.
> Heat Pump Outdoor Units and Indoor Units remain out of scope.

That exclusion was a mistake. The intent of `status` is to drive a future
splash-page dashboard that reports documentation completeness, and the unit of
documentation is the **Datasheet** slot. Every table that has a `Datasheet`
field should carry `status`. A `datasheet`-field audit of the backend tables
shows exactly three Datasheet-bearing tables are still missing `status`:

| Table | Has `Datasheet`? | Has `status` today? |
|---|---|---|
| Ventilators (`ventilators`) | yes | **no** ← fix |
| Heat-Pump Outdoor Units (`heat_pumps_outdoor_units`) | yes | **no** ← fix |
| Heat-Pump Indoor Units (`heat_pumps_indoor_units`) | yes | **no** ← fix |

(For reference: Thermal Bridges carries `status` *without* a Datasheet — it is the
lone dashboard-accounting exception. After this addendum, "has a Datasheet" ⇒
"has `status`" holds for every DataTable-backed table.)

This addendum reuses the original feature's shared machinery verbatim — the
`_status_field.py` helper, the `<table_label>.status` option-key namespace, the
frontend `lib/statusColumn.ts` and `heat-pumps/status-column.ts` helpers, the
`STATUS_TABLE_NAMES` drift guard, and the reset/reseed pipeline. No new patterns
are introduced; three tables are added to an existing, proven path.

## Scope

Add the built-in `status` field (identical contract to the original) to:

- **Ventilators** — shared project-document table.
- **Heat-Pump Outdoor Units** — heat-pump leaf table.
- **Heat-Pump Indoor Units** — heat-pump leaf table.

Out of scope (unchanged from the original): Rooms, Space Types, Apertures,
Envelope assemblies/Materials (`specification_status` is separate). The nine
already-done tables are untouched except for the `STATUS_TABLE_NAMES` /
drift-guard expansion.

## Read order

1. `README.md` — scope and routing (this file).
2. `PRD.md` — behavior contract, the Non-Goal reversal, and open decisions.
3. `PLAN.md` — implementation sequence and validation gates.
4. `STATUS.md` — current state and next action.
5. `phases/phase-01-backend-contract-and-seeds.md`
6. `phases/phase-02-backend-validation-tests.md`
7. `phases/phase-03-frontend-types-ui.md`
8. `phases/phase-04-reset-reseed-smoke.md`
9. `phases/phase-05-closeout-docs.md`

## Key source touchpoints

Backend:
- `backend/features/project_document/tables/_status_field.py` — add the three
  names to `STATUS_TABLE_NAMES` (single source of truth + drift guard).
- `backend/features/project_document/tables/ventilators.py` — mirror the
  `pumps.py` status wiring (ventilators already carries one built-in
  single-select, `inside_outside`, so add `status` as a second one).
- `backend/features/project_document/tables/heat_pumps.py` — give
  `OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS` / `INDOOR_UNITS_BUILT_IN_FIELD_DEFS` the
  `status_field_def()`, add `HEAT_PUMPS_{OUTDOOR,INDOOR}_UNITS_STATUS_OPTION_KEY`,
  and convert `OutdoorUnitsOptions` / `IndoorUnitsOptions` from
  `NoBuiltInOptions` to status-bearing leaves (mirror `OutdoorEquipOptions` /
  `IndoorEquipOptions`).
- `backend/features/project_document/templates.py` — add `<table>.status` option
  lists for the three tables in `empty_project_document()`.
- `backend/seeds/project/ventilators.json`, `backend/seeds/project/heat-pumps.json`
  — add status option lists + distribute `custom_values.status` across rows.

Frontend:
- `frontend/src/features/equipment/components/VentilatorsTable.tsx` — insert
  `statusColumn<VentilatorRow>(fieldDefByKey)` into the `columns` array (exactly
  like `PumpsTable.tsx`).
- `frontend/src/features/equipment/lib/buildEmptyVentilatorRow.ts` — carry
  `fieldDefaults.status` into `custom_values.status`.
- `frontend/src/features/equipment/heat-pumps/outdoor-unit-columns.tsx`,
  `indoor-unit-columns.tsx` — add `statusFieldDef(...)` + `statusColumnDef<...>()`
  (the helpers in `heat-pumps/status-column.ts` are already generic across
  leaves — equip columns use them at lines 103/251 of `outdoor-equip-columns.tsx`).
- `frontend/src/features/equipment/heat-pumps/{types,option-helpers,row-builders,payload-builders}.ts`
  — extend the Units option maps + carry the status default/value.
- `frontend/src/features/equipment/heat-pumps/components/{OutdoorUnitsTable,IndoorUnitsTable}.tsx`
  — wire the `status → setCustomValue` cell-write seam (mirror the equip leaves).

Tests:
- `backend/tests/test_project_document_ventilators.py` (or equivalent),
  `backend/tests/features/heat_pumps/test_heat_pumps.py`,
  `backend/tests/test_seed_dev_db.py`, plus the `STATUS_TABLE_NAMES` drift guard.
- `frontend/.../VentilatorsTable.reuse.test.tsx`,
  `heat-pumps/__tests__/{OutdoorUnitsTable,IndoorUnitsTable}.test.tsx`.

## Phase map

| Phase | Status | Purpose |
|---|---|---|
| Phase 01 | Done | Backend field defs, option keys, new-document defaults, seed values for the 3 tables. |
| Phase 02 | Done | Backend validation, per-table round-trip tests, drift-guard expansion (12 tables). |
| Phase 03 | Done | Frontend schemas, columns, row/payload builders, UI tests for the 3 tables. |
| Phase 04 | Done | Reset/reseed local dev DB; API smoke + live write round-trip + Ventilators browser render. |
| Phase 05 | Done | Simplify + docs-pass + `make ci` (green) + graphify + commit `d8b59f28`. |
