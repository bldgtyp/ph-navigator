---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Roll backend custom-field registry support across remaining Equipment and Thermal Bridges tables.
RELATED: planning/archive/equipment-custom-fields/phases/phase-01-backend-registry-pilot.md; backend/features/project_document/tables/ventilators.py; backend/features/project_document/tables/fans.py; backend/features/project_document/tables/hot_water_heaters.py; backend/features/project_document/tables/hot_water_tanks.py; backend/features/project_document/tables/electric_heaters.py; backend/features/project_document/tables/appliances.py; backend/features/project_document/tables/thermal_bridges.py
---

# Phase 02 - Backend Registry Rollout

## Goal

Apply the Pumps pilot pattern to every remaining target table so the
generic schema-mutation route accepts valid `addField` and related
custom-field mutations for all Equipment and Thermal Bridges tables in
scope.

## Preconditions

- Phase 01 is complete.
- Pumps has a real published `TableFieldRegistry` and focused backend
  tests.
- Any helper extraction identified during Phase 01 is either complete
  or explicitly deferred.

## Target Tables

- `ventilators`
- `fans`
- `hot_water_heaters`
- `hot_water_tanks`
- `electric_heaters`
- `appliances`
- `thermal_bridges`

## Implementation Tasks

For each target table:

1. [x] Add or complete `TableFieldRegistry` support:
   - [x] built-in `field_keys`
   - [x] table path
   - [x] `read_field_defs`
   - [x] `replace_field_defs`
   - [x] `read_row_custom_values`
   - [x] `set_row_custom_values`
   - [x] `read_row_links`
   - [x] `set_row_links`
   - [x] schema fingerprint
   - [x] built-in single-select option-list helpers where applicable
   - [x] built-in option-value read / set helpers where applicable
   - [x] formula field-value and type readers where safe
2. [x] Add real apply / validate wrappers that delegate to
   `features.project_document.schema_mutations`.
3. [x] Publish the registry on the table's `TableContract.field_registry`.
4. [x] Preserve existing replace payload behavior:
   - [x] `field_defs` round-trip unchanged on cell writes, row inserts, row
     deletes, row duplicates, and option edits
   - [x] attachment ID arrays remain core row fields
   - [x] PHN-defined URL / datasheet / report fields stay locked by
     frontend overlays
5. [x] Keep point-in-time formulas conservative. If a table lacks a reliable
   formula type mapping for a built-in field, return `None` for that
   built-in and let custom fields resolve from persisted `field_defs`.

## Table-Specific Notes

- Ventilators: preserve `inside_outside` option editing and heat-pump
  linked indoor count as a frontend-only display column.
- Fans: preserve type option editing and datasheet attachment behavior.
- Hot Water Heaters / Tanks: preserve type option editing and datasheet
  attachment behavior.
- Electric Heaters: no attachment hazard, but still validate typed
  physical fields and option-free writes.
- Appliances: preserve appliance type and Energy Star option lists.
- Thermal Bridges: preserve thermal bridge type options and PDF report
  attachment behavior.

## Tests

Add backend coverage that proves:

- [x] `addField` succeeds on every target table.
- [x] `deleteField` clears custom values on at least one simple target table
  and one attachment-heavy target table.
- [x] single-select custom-field options are namespaced to the table path
  and do not collide with built-in option lists.
- [x] existing built-in option edits still work for representative tables.
- [x] unsupported or mismatched table-key mutations still reject with the
  existing structured errors.

Prefer parameterized tests over copy-paste where table fixtures allow
it. Keep explicit single-table tests where attachment or option-list
behavior differs materially.

## Acceptance Criteria

- [x] Every target contract publishes a non-null `field_registry`.
- [x] Valid schema mutations no longer fail with
  `custom_field_unsupported_table` for any target table.
- [x] Existing backend tests for Rooms, Pumps, equipment payload builders,
  attachments, and record-linking continue to pass.
- [x] Focused backend test commands and results are recorded in
  `STATUS.md`.

## Completion Evidence

- Added shared registry helpers in
  `backend/features/project_document/tables/_registry_helpers.py` and
  used them from Ventilators, Fans, Hot Water Heaters, Hot Water Tanks,
  Electric Heaters, Appliances, and Thermal Bridges.
- Updated nested-table mutation guards so row mutations resolve through
  `TableContract.table_path` instead of assuming `body.tables.<key>`.
- Added focused Phase 02 backend coverage in
  `backend/tests/test_project_document_equipment_custom_fields_phase_02.py`.
- Focused backend verification passed:
  - `cd backend && uv run ruff check ...`
  - `cd backend && uv run pytest tests/test_project_document_equipment_custom_fields_phase_02.py tests/test_project_document_pumps.py`
  - `cd backend && uv run pytest tests/test_project_document_equipment_custom_fields_phase_02.py tests/test_project_document_pumps.py tests/test_project_document_ventilators.py tests/test_project_document_fans.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_thermal_bridges.py tests/test_project_document_schema_mutation_endpoint.py`

## Stop Condition

Phase 02 stopped after backend support was completed for all target
contracts and focused backend tests passed. Frontend affordance wiring
is intentionally not started here; resume with Phase 03.
