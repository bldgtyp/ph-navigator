---
DATE: 2026-06-24
TIME: 08:50 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Backend validation, API, and seed-assembly test plan for the DataTable status field.
RELATED: planning/refactor/data-table-status-field/PLAN.md, planning/refactor/data-table-status-field/phases/phase-01-contract-and-seeds.md
---

# Phase 02 - Backend Validation And Tests

> **Outcome (2026-06-24):** Implemented. Each in-scope table's slice
> `single_select_options` contract now accepts, persists, and emits its
> `<table_label>.status` option list, wired through the existing built-in
> option-key machinery: new `*_STATUS_OPTION_KEY` constants appended to each
> `*_OPTION_KEYS` tuple in `document.py` (with matching `*OptionKey` Literal
> aliases and `__all__` exports), a `status` field on each `*SliceOptions`
> model (+ `by_option_key`), status surfaced in every response/diff dict, the
> Electric Heaters dict-shaped response, and the Heat Pump Outdoor/Indoor
> Equipment leaf options. New `tests/status_field_helpers.py` shared
> assertions; per-table status tests (slice-exposes / replace-persists /
> rejects-unknown) across all seven shared tables + both heat-pump equip
> leaves; seed test asserts seeded status options/values; a drift-guard test
> asserts `STATUS_TABLE_NAMES` matches the registered contracts. Updated
> pre-existing asset/orphan/bulk pumps payloads for the now-required
> `pumps.status` key, and renamed a colliding custom "Status" field in the
> phase-02 custom-field test. **`make check-backend` green: 1061 passed, 2
> skipped.** Heat Pump Outdoor/Indoor Units remain unchanged.

## Objective

Make the backend treat `status` like a normal built-in single-select field everywhere the target tables read, replace, validate, and seed project-document slices.

## Backend Wiring Tasks

- [x] Update every in-scope shared table option contract so its `single_select_options` payload accepts and emits the new status key:
  - `thermal_bridges.status`
  - `pumps.status`
  - `fans.status`
  - `hot_water_heaters.status`
  - `hot_water_tanks.status`
  - `electric_heaters.status`
  - `appliances.status`
- [x] For option models currently using exact Pydantic fields, add status as a named field or shift to the existing extras pattern when that table already supports custom option lists.
- [x] For Electric Heaters, confirm its dictionary-shaped `single_select_options` path validates the new built-in single-select option list without a custom model.
- [x] Update Heat Pump leaf option exposure so only these leaves emit status:
  - `heat_pumps_outdoor_equip.status`
  - `heat_pumps_indoor_equip.status`
- [x] Keep Heat Pump option ownership clear:
  - `heat_pumps.manufacturer`, `heat_pumps.system_family`, `heat_pumps.refrigerant`, `heat_pumps.model_type`, `heat_pumps.install_type` remain existing heat-pump-owned dropdowns.
  - `heat_pumps_outdoor_equip.status` and `heat_pumps_indoor_equip.status` are leaf-table FieldDef option lists.
- [x] Confirm `validate_document()` sees the status FieldDef and rejects a `custom_values.status` value outside its namespaced option list.
- [x] Confirm `field_defs_fingerprint()` changes are expected and update tests by deriving fingerprints from the live response, not hard-coding old lists.

## Test Tasks

- [x] Add a shared assertion helper for status FieldDefs and options if it prevents repeated table-specific test code.
- [x] Extend backend table tests to assert:
  - `status` is present in `field_defs`.
  - `status` has `field_type == "single_select"`, `origin == "built_in"`, and default `opt_status_needed`.
  - the table response includes its namespaced `*.status` options.
  - a valid write persists `custom_values.status`.
  - an invalid write using an unknown option id fails.
- [x] Cover shared tables in:
  - `backend/tests/test_project_document_thermal_bridges.py`
  - `backend/tests/test_project_document_pumps.py`
  - `backend/tests/test_project_document_fans.py`
  - `backend/tests/test_project_document_hot_water_heaters.py`
  - `backend/tests/test_project_document_hot_water_tanks.py`
  - `backend/tests/test_project_document_electric_heaters.py`
  - `backend/tests/test_project_document_appliances.py`
- [x] Cover Heat Pump Outdoor Equipment and Indoor Equipment in `backend/tests/features/heat_pumps/test_heat_pumps.py`.
- [x] Extend `backend/tests/test_seed_dev_db.py` to assert seeded starter documents include status FieldDefs/options and seeded row values.

## Suggested Focused Checks

```sh
cd backend && uv run pytest \
  backend/tests/test_project_document_thermal_bridges.py \
  backend/tests/test_project_document_pumps.py \
  backend/tests/test_project_document_fans.py \
  backend/tests/test_project_document_hot_water_heaters.py \
  backend/tests/test_project_document_hot_water_tanks.py \
  backend/tests/test_project_document_electric_heaters.py \
  backend/tests/test_project_document_appliances.py \
  backend/tests/features/heat_pumps/test_heat_pumps.py \
  backend/tests/test_seed_dev_db.py
```

Then run:

```sh
make check-backend
```

## Completion Criteria

- Backend table responses expose the `status` FieldDef and options for every in-scope table.
- Backend writes persist valid `custom_values.status` values.
- Backend validation rejects unknown option ids.
- Heat Pump Outdoor Units and Indoor Units remain unchanged.
- Focused backend tests pass.
