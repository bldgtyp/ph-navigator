---
DATE: 2026-06-24
TIME: 00:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Backend validation, API, and seed-assembly test plan for the DataTable status field.
RELATED: planning/refactor/data-table-status-field/PLAN.md, planning/refactor/data-table-status-field/phases/phase-01-contract-and-seeds.md
---

# Phase 02 - Backend Validation And Tests

## Objective

Make the backend treat `status` like a normal built-in single-select field everywhere the target tables read, replace, validate, and seed project-document slices.

## Backend Wiring Tasks

- [ ] Update every in-scope shared table option contract so its `single_select_options` payload accepts and emits the new status key:
  - `thermal_bridges.status`
  - `pumps.status`
  - `fans.status`
  - `hot_water_heaters.status`
  - `hot_water_tanks.status`
  - `electric_heaters.status`
  - `appliances.status`
- [ ] For option models currently using exact Pydantic fields, add status as a named field or shift to the existing extras pattern when that table already supports custom option lists.
- [ ] For Electric Heaters, confirm its dictionary-shaped `single_select_options` path validates the new built-in single-select option list without a custom model.
- [ ] Update Heat Pump leaf option exposure so only these leaves emit status:
  - `heat_pumps_outdoor_equip.status`
  - `heat_pumps_indoor_equip.status`
- [ ] Keep Heat Pump option ownership clear:
  - `heat_pumps.manufacturer`, `heat_pumps.system_family`, `heat_pumps.refrigerant`, `heat_pumps.model_type`, `heat_pumps.install_type` remain existing heat-pump-owned dropdowns.
  - `heat_pumps_outdoor_equip.status` and `heat_pumps_indoor_equip.status` are leaf-table FieldDef option lists.
- [ ] Confirm `validate_document()` sees the status FieldDef and rejects a `custom_values.status` value outside its namespaced option list.
- [ ] Confirm `field_defs_fingerprint()` changes are expected and update tests by deriving fingerprints from the live response, not hard-coding old lists.

## Test Tasks

- [ ] Add a shared assertion helper for status FieldDefs and options if it prevents repeated table-specific test code.
- [ ] Extend backend table tests to assert:
  - `status` is present in `field_defs`.
  - `status` has `field_type == "single_select"`, `origin == "built_in"`, and default `opt_status_needed`.
  - the table response includes its namespaced `*.status` options.
  - a valid write persists `custom_values.status`.
  - an invalid write using an unknown option id fails.
- [ ] Cover shared tables in:
  - `backend/tests/test_project_document_thermal_bridges.py`
  - `backend/tests/test_project_document_pumps.py`
  - `backend/tests/test_project_document_fans.py`
  - `backend/tests/test_project_document_hot_water_heaters.py`
  - `backend/tests/test_project_document_hot_water_tanks.py`
  - `backend/tests/test_project_document_electric_heaters.py`
  - `backend/tests/test_project_document_appliances.py`
- [ ] Cover Heat Pump Outdoor Equipment and Indoor Equipment in `backend/tests/features/heat_pumps/test_heat_pumps.py`.
- [ ] Extend `backend/tests/test_seed_dev_db.py` to assert seeded starter documents include status FieldDefs/options and seeded row values.

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
