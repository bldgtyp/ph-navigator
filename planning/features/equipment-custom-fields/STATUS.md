---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Active
AUTHOR: Codex
SCOPE: Current status for Equipment and Thermal Bridges custom-field wiring.
RELATED: planning/features/equipment-custom-fields/README.md; planning/features/equipment-custom-fields/PLAN.md
---

# Equipment Custom Fields Status

## Current State

Phase 01 backend registry pilot is implemented for Pumps. Phase 02
backend registry rollout is implemented for Ventilators, Fans, Hot
Water Heaters, Hot Water Tanks, Electric Heaters, Appliances, and
Thermal Bridges. Every target table contract now publishes a non-null
`field_registry` and routes schema mutations through the shared
`custom-fields:mutate` dispatcher.

Rooms already has the desired behavior. Equipment and Thermal Bridges
currently render the shared `AddFieldTailCell` in disabled mode because
their table components do not receive `onAddCustomField`.

The backend blocker for enabling the buttons is cleared. Phase 03 can
wire the existing Rooms-style controller handlers through the target
table components.

## Next Step

Start `phases/phase-03-frontend-affordance-wiring.md`: forward the
existing custom-field handlers through every target table component.

## Blockers

None for Phase 03. Backend mutation support now exists for every target
contract in this feature.

## Verification To Date

- `cd backend && uv run ruff check tests/test_project_document_pumps.py features/project_document/tables/pumps.py` - passed.
- `cd backend && uv run pytest tests/test_project_document_pumps.py` - passed, 8 tests.
- `$simplify` pass completed; the only actionable cleanup was stale
  Pumps module-docstring wording, now updated.
- `cd backend && uv run ruff check features/project_document/tables/_registry_helpers.py features/project_document/tables/contracts.py features/project_document/mutations/guards.py features/project_document/tables/ventilators.py features/project_document/tables/fans.py features/project_document/tables/hot_water_heaters.py features/project_document/tables/hot_water_tanks.py features/project_document/tables/electric_heaters.py features/project_document/tables/appliances.py features/project_document/tables/thermal_bridges.py tests/test_project_document_equipment_custom_fields_phase_02.py` - passed.
- `cd backend && uv run ty check features/project_document/tables/_registry_helpers.py features/project_document/tables/contracts.py features/project_document/mutations/guards.py features/project_document/tables/ventilators.py features/project_document/tables/fans.py features/project_document/tables/hot_water_heaters.py features/project_document/tables/hot_water_tanks.py features/project_document/tables/electric_heaters.py features/project_document/tables/appliances.py features/project_document/tables/thermal_bridges.py tests/test_project_document_equipment_custom_fields_phase_02.py` - passed.
- `cd backend && uv run pytest tests/test_project_document_equipment_custom_fields_phase_02.py tests/test_project_document_pumps.py` - passed, 27 tests.
- `cd backend && uv run pytest tests/test_project_document_equipment_custom_fields_phase_02.py tests/test_project_document_pumps.py tests/test_project_document_ventilators.py tests/test_project_document_fans.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_thermal_bridges.py tests/test_project_document_schema_mutation_endpoint.py` - passed, 63 tests.
- `$simplify` pass completed for Phase 02; actionable reuse/quality findings were fixed by deriving option namespaces from table paths and moving generic envelope helpers to `tables/contracts.py`.
- `$docs-pass` completed; feature planning docs were updated, and no stable `context/` doc change was needed.
- `make format` - passed; no files changed.
- `make ci` - passed; backend `804 passed, 2 skipped, 1 warning`; frontend lint had 3 existing fast-refresh warnings, Vitest `160 passed` files / `1575 passed` tests, production build passed with existing chunk-size warning.

## Phase Ledger

| Phase | Status | Exit Evidence |
| --- | --- | --- |
| 01 - Backend registry pilot | Complete | `pumps_contract.field_registry=pumps_field_registry`; focused Pumps tests pass. |
| 02 - Backend registry rollout | Complete | All remaining target contracts publish registries; focused Phase 02 backend tests pass. |
| 03 - Frontend affordance wiring | Pending | Pending. |
| 04 - Verification and closeout | Pending | Pending. |
