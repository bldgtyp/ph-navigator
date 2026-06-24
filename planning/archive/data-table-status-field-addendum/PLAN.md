---
DATE: 2026-06-24
TIME: 11:30 EDT
STATUS: Complete
AUTHOR: Claude
SCOPE: Implementation plan for the DataTable Status Field addendum (3 Datasheet-bearing tables).
RELATED: planning/archive/data-table-status-field-addendum/PRD.md, planning/archive/data-table-status-field-addendum/STATUS.md
---

# Plan — DataTable Status Field Addendum

Guiding principle: **reuse, don't reinvent.** The original feature built every
shared helper this needs. Each phase below extends an existing path to three more
tables; no new abstraction should be introduced. If a step tempts you to fork the
single-select render path or duplicate `_status_field.py` logic, stop — that
violates the DataTable-uniformity rule and the original design.

## Phase 01 — Backend contract and seeds

1. Add `"ventilators"`, `"heat_pumps_outdoor_units"`, `"heat_pumps_indoor_units"`
   to `STATUS_TABLE_NAMES` in `tables/_status_field.py`.
2. `ventilators.py`: append `status_field_def()` to
   `VENTILATORS_BUILT_IN_FIELD_DEFS`; add a `VENTILATOR_STATUS_OPTION_KEY`
   constant; add it to `VENTILATOR_OPTION_KEYS`; add a `status` field to
   `VentilatorsSliceOptions` (alias = the status option key) and surface it in
   `by_option_key()`; thread it through the replace/persist logic and add
   `"status": VENTILATOR_STATUS_OPTION_KEY` to the registry's
   `built_in_option_key_by_field_key`. Mirror `pumps.py`, which already carries a
   second built-in single-select (`device_type`) alongside `status`.
3. `heat_pumps.py`: append `status_field_def()` to
   `OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS` and `INDOOR_UNITS_BUILT_IN_FIELD_DEFS`; add
   `HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY` /
   `HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY`; convert `OutdoorUnitsOptions` /
   `IndoorUnitsOptions` from `NoBuiltInOptions` to status-bearing leaves
   (`status` field + `built_in_options()`), mirroring `OutdoorEquipOptions` /
   `IndoorEquipOptions`; add `"status": …_UNITS_STATUS_OPTION_KEY` to each unit
   leaf's registry `built_in_option_key_by_field_key`. The generic
   `_read_status_aware_option_value` / `_set_status_aware_option_value` seam is
   already wired in `_make_registry`, so the units inherit it for free.
4. Add `<table>.status` option lists to the three tables in
   `empty_project_document()` (`templates.py`).
5. Seeds: add the three `<table>.status` option lists and distribute
   `custom_values.status` (`Complete` / `Needed` / `Question` / `N/A`) across
   rows in `backend/seeds/project/ventilators.json` and
   `backend/seeds/project/heat-pumps.json`.

## Phase 02 — Backend validation and tests

1. Confirm each new table's slice option model round-trips its `<table>.status`
   key (GET exposes FieldDef + options; PUT persists `custom_values.status`).
2. Extend backend tests for `ventilators` and the two heat-pump unit leaves to
   assert the FieldDef, option list, persistence, and 422-on-unknown-id behavior.
3. **Update the drift-guard test** so the expected `STATUS_TABLE_NAMES` set is 12
   and matches the registry contracts carrying the status FieldDef. This is the
   uniformity enforcement point — it must go red until all three tables are wired,
   then green.
4. Extend `test_seed_dev_db.py` so the assembled starter document validates with
   the three new tables' status options/values present.
5. `make check-backend` green.

## Phase 03 — Frontend types, defaults, and UI

1. **Ventilators (shared-table path):** import `statusColumn` and insert
   `statusColumn<VentilatorRow>(fieldDefByKey)` into the `columns` array in
   `VentilatorsTable.tsx` (identical to `PumpsTable.tsx:231`). Carry
   `fieldDefaults.status` in `buildEmptyVentilatorRow.ts`. Extend the ventilators
   option-map type in `equipment/types.ts` (or the ventilator types module) so
   the `ventilators.status` key type-checks.
2. **Heat-Pump Units (parallel HP path):** in `outdoor-unit-columns.tsx` /
   `indoor-unit-columns.tsx`, add `statusFieldDef(options[…_UNITS_STATUS_OPTION_KEY] ?? [])`
   to the FieldDefs and `statusColumnDef<…UnitRow>()` to the column list (mirror
   `outdoor-equip-columns.tsx:103,251`). Extend the Units option maps in
   `heat-pumps/types.ts` and `heat-pumps/option-helpers.ts`; carry the status
   default in `row-builders.ts` and the value in `payload-builders.ts`; wire the
   `status → setCustomValue` cell-write seam in `OutdoorUnitsTable.tsx` /
   `IndoorUnitsTable.tsx` exactly as the equip leaves do.
3. No bespoke status cell renderer — the generic single-select pill already
   paints the four option colors.
4. Add/extend focused frontend tests: `VentilatorsTable.reuse.test.tsx`,
   `heat-pumps/__tests__/OutdoorUnitsTable.test.tsx`,
   `heat-pumps/__tests__/IndoorUnitsTable.test.tsx` — assert the `Status` column
   renders, defaults to `Needed` on new rows, and edits/persists through the
   shared cell path.
5. `make frontend-dev-check` green; run `pnpm run format`.

## Phase 04 — Local reset, reseed, and smoke

1. Focused checks first:
   - `cd backend && uv run pytest <ventilators test> backend/tests/features/heat_pumps/test_heat_pumps.py backend/tests/test_seed_dev_db.py`
   - `cd frontend && pnpm exec vitest run <the three table tests>`
2. `make check-backend` and `make frontend-dev-check`.
3. Reset/reseed the local dev DB with the repo pipeline:
   - `make db-reset-dev`
   - `make seed-agent-user`
   - `cd backend && uv run python -m scripts.check_db`
4. Browser smoke on `http://localhost:5173`, **signed in as `ed@example.com`**
   (the seed project owner — see memory; `codex@example.com` owns no project):
   - Open Ventilators, Heat-Pump Outdoor Units, Heat-Pump Indoor Units.
   - Confirm `Status` renders as a single-select column with the four seeded
     values.
   - Edit one row per table through Complete / Needed / Question / N/A; reload and
     confirm persistence (expect PUT 200).
   - Confirm the nine original tables and out-of-scope tables are unchanged.

## Phase 05 — Closeout

1. Run the repo closeout gate: `simplify` skill on the diff, `docs-pass` skill on
   the diff, `make format`, then `make ci` (must be green).
2. `graphify update .` after code changes.
3. Update `context/technical-requirements/data-table.md`: record that the status
   table list is now Datasheet-driven (every Datasheet-bearing table carries
   `status`; `STATUS_TABLE_NAMES` = 12) and that the drift guard enforces it.
4. Update this packet's `STATUS.md` and phase ledger with exact commands and
   outcomes; flip `planning/STATUS.md` and the README phase map to Complete.

## Implementation notes / risks

- **Drift guard is the iron-law enforcement point.** `STATUS_TABLE_NAMES` and its
  test are the single source of truth; updating them is what makes "Datasheet ⇒
  status" structurally enforced rather than per-table opt-in.
- **Ventilators already has a built-in single-select.** Use `pumps.py` (not the
  simpler tables) as the copy source, since pumps demonstrates two built-in
  single-selects (`device_type` + `status`) coexisting.
- **Heat-Pump Units carry link/aggregate behavior** (units link to equipment via
  the heat-pump-link-fields feature). Verify in Phase 03/04 that adding `status`
  to a unit leaf does not perturb the linked-field or aggregate response paths;
  the equip leaves already prove status coexists with leaf responses, so risk is
  low but should be smoked.
- **Ventilator modal** (`VentilatorRowModal`) is a secondary edit affordance; per
  the open decision in the PRD, the inline column is authoritative and the modal
  is not modified unless Ed asks.
