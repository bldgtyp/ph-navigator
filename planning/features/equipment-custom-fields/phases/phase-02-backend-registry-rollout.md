---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Roll backend custom-field registry support across remaining Equipment and Thermal Bridges tables.
RELATED: planning/features/equipment-custom-fields/phases/phase-01-backend-registry-pilot.md; backend/features/project_document/tables/ventilators.py; backend/features/project_document/tables/fans.py; backend/features/project_document/tables/hot_water_heaters.py; backend/features/project_document/tables/hot_water_tanks.py; backend/features/project_document/tables/electric_heaters.py; backend/features/project_document/tables/appliances.py; backend/features/project_document/tables/thermal_bridges.py
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

1. Add or complete `TableFieldRegistry` support:
   - built-in `field_keys`
   - table path
   - `read_field_defs`
   - `replace_field_defs`
   - `read_row_custom_values`
   - `set_row_custom_values`
   - `read_row_links`
   - `set_row_links`
   - schema fingerprint
   - built-in single-select option-list helpers where applicable
   - built-in option-value read / set helpers where applicable
   - formula field-value and type readers where safe
2. Add real apply / validate wrappers that delegate to
   `features.project_document.schema_mutations`.
3. Publish the registry on the table's `TableContract.field_registry`.
4. Preserve existing replace payload behavior:
   - `field_defs` round-trip unchanged on cell writes, row inserts, row
     deletes, row duplicates, and option edits
   - attachment ID arrays remain core row fields
   - PHN-defined URL / datasheet / report fields stay locked by
     frontend overlays
5. Keep point-in-time formulas conservative. If a table lacks a reliable
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

- `addField` succeeds on every target table.
- `deleteField` clears custom values on at least one simple target table
  and one attachment-heavy target table.
- single-select custom-field options are namespaced to the table path
  and do not collide with built-in option lists.
- existing built-in option edits still work for representative tables.
- unsupported or mismatched table-key mutations still reject with the
  existing structured errors.

Prefer parameterized tests over copy-paste where table fixtures allow
it. Keep explicit single-table tests where attachment or option-list
behavior differs materially.

## Acceptance Criteria

- Every target contract publishes a non-null `field_registry`.
- Valid schema mutations no longer fail with
  `custom_field_unsupported_table` for any target table.
- Existing backend tests for Rooms, Pumps, equipment payload builders,
  attachments, and record-linking continue to pass.
- Focused backend test commands and results are recorded in
  `STATUS.md`.

## Stop Condition

Stop after backend support is complete for all target contracts and
focused backend tests pass. Do not begin frontend affordance wiring
until this phase is green.
