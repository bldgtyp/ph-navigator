---
DATE: 2026-06-24
TIME: 11:00 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Phase 01 — backend field defs, option keys, document defaults, and seeds for the three new tables.
RELATED: planning/archive/data-table-status-field-addendum/PLAN.md
---

# Phase 01 — Backend Contract and Seeds

## Goal

Every new/seeded project document carries the built-in `status` FieldDef and a
`<table>.status` option list for `ventilators`, `heat_pumps_outdoor_units`, and
`heat_pumps_indoor_units`, and the local seed exercises all four statuses on
those tables.

## Steps

1. **Drift source of truth.** In
   `backend/features/project_document/tables/_status_field.py`, append
   `"ventilators"`, `"heat_pumps_outdoor_units"`, `"heat_pumps_indoor_units"` to
   `STATUS_TABLE_NAMES` (now 12 entries).

2. **Ventilators** (`tables/ventilators.py`) — copy source is `pumps.py`:
   - Append `status_field_def()` to `VENTILATORS_BUILT_IN_FIELD_DEFS`.
   - Add `VENTILATOR_STATUS_OPTION_KEY = status_option_key(VENTILATORS_TABLE_NAME)`
     and include it in `VENTILATOR_OPTION_KEYS`.
   - Add a `status` field to `VentilatorsSliceOptions`
     (`Field(alias=VENTILATOR_STATUS_OPTION_KEY)`) and surface it in
     `by_option_key()` / the slice serialization, alongside the existing
     `inside_outside` option.
   - Thread the status key through the replace/persist logic (the block that
     copies option lists onto `single_select_options`).
   - Add `"status": VENTILATOR_STATUS_OPTION_KEY` to the registry's
     `built_in_option_key_by_field_key`.

3. **Heat-Pump Units** (`tables/heat_pumps.py`) — copy source is the equip leaves:
   - Append `status_field_def()` to `OUTDOOR_UNITS_BUILT_IN_FIELD_DEFS` and
     `INDOOR_UNITS_BUILT_IN_FIELD_DEFS`.
   - Add `HEAT_PUMPS_OUTDOOR_UNITS_STATUS_OPTION_KEY` /
     `HEAT_PUMPS_INDOOR_UNITS_STATUS_OPTION_KEY`
     (`= f"{…_UNITS_TABLE_NAME}.status"`).
   - Convert `OutdoorUnitsOptions` / `IndoorUnitsOptions` from `NoBuiltInOptions`
     to status-bearing classes: add the `status` field
     (`Field(alias=…_UNITS_STATUS_OPTION_KEY)`) and a `built_in_options()` that
     returns `{…_UNITS_STATUS_OPTION_KEY: self.status}` — mirror
     `OutdoorEquipOptions` / `IndoorEquipOptions`.
   - In each unit leaf's `_make_registry` call, set
     `built_in_option_key_by_field_key={"status": …_UNITS_STATUS_OPTION_KEY}`.
     (The `read/set_built_in_option_value` lambdas already route through the
     generic `_read/_set_status_aware_option_value` seam.)

4. **New-document defaults.** In `templates.py`, add the three `<table>.status`
   option lists (from `status_option_list()`) to `empty_project_document()`.

5. **Seeds.**
   - `backend/seeds/project/ventilators.json`: add the `ventilators.status`
     option list; set `custom_values.status` on the seeded ventilator rows,
     distributing Complete / Needed / Question / N/A.
   - `backend/seeds/project/heat-pumps.json`: add
     `heat_pumps_outdoor_units.status` and `heat_pumps_indoor_units.status`
     option lists; set `custom_values.status` on seeded unit rows, distributing
     the four statuses.

## Verification

- `uv run ruff format` / `ruff check` clean on the touched modules
  (`_status_field.py`, `ventilators.py`, `heat_pumps.py`, `templates.py`,
  `scripts/seed_dev_db.py` if touched).
- `empty_project_document()` builds with `status` FieldDefs + `<table>.status`
  option lists on all three new tables.
- The seed-assembled starter document passes `validate_document()`; seeded rows
  exercise all four statuses on the three tables.
- An unknown `status` option id is rejected through the existing single-select
  `coerce_custom_value` path on each new table.

## Done when

All three tables expose `status` on a fresh `empty_project_document()` and on the
assembled seed, and `STATUS_TABLE_NAMES` has 12 entries. (The drift-guard test is
expected to be red until Phase 02 updates its expected set — that is the signal
the iron-law is doing its job.)
