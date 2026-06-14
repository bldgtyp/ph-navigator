---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Current status for Equipment and Thermal Bridges custom-field wiring.
RELATED: planning/archive/equipment-custom-fields/README.md; planning/archive/equipment-custom-fields/PLAN.md
---

# Equipment Custom Fields Status

## Current State

Phase 01 backend registry pilot is implemented for Pumps. Phase 02
backend registry rollout is implemented for Ventilators, Fans, Hot
Water Heaters, Hot Water Tanks, Electric Heaters, Appliances, and
Thermal Bridges. Every target table contract now publishes a non-null
`field_registry` and routes schema mutations through the shared
`custom-fields:mutate` dispatcher.

Phase 03 frontend affordance wiring is implemented. Ventilators,
Pumps, Fans, Hot Water Heaters, Hot Water Tanks, Electric Heaters,
Appliances, and Thermal Bridges now render user-defined custom columns
from `tableSchema.customFields`; their table components accept the
shared DataTable schema callbacks, and their slots/pages pass the
controller handlers only when `controller.canEdit` is true.

Phase 04 verification and closeout is implemented. Focused backend and
frontend test slices pass, browser smoke covered editor custom-field
authoring for Pumps, Ventilators, and Thermal Bridges, and locked
version state hides schema-mutation controls. The closeout simplify
pass also fixed a formula-field rendering gap by plumbing
`rows_computed` through every newly enabled target table response and
table component.

## Next Step

None for implementation. This feature is complete and archived.

## Blockers

None for Phase 04.

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
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx src/features/equipment/__tests__/RoomsTable.addField.test.tsx` - passed, 23 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx src/features/equipment/__tests__/RoomsTable.addField.test.tsx src/features/equipment/__tests__/RoomsTable.customField.test.tsx src/features/equipment/__tests__/RoomsTable.formulaField.test.tsx src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/features/equipment/__tests__/VentilatorsTable.reuse.test.tsx src/features/equipment/__tests__/FansTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterHeatersTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterTanksTable.reuse.test.tsx src/features/equipment/__tests__/ElectricHeatersTable.reuse.test.tsx src/features/equipment/__tests__/AppliancesTable.reuse.test.tsx` - passed, 61 tests.
- `cd frontend && pnpm exec eslint src/shared/ui/data-table/feature/customFieldColumns.tsx src/shared/ui/data-table/feature/index.ts src/features/equipment/components/RoomsTable.tsx src/features/equipment/components/PumpsTable.tsx src/features/equipment/components/PumpsTableSlot.tsx src/features/equipment/components/VentilatorsTable.tsx src/features/equipment/components/VentilatorsTableSlot.tsx src/features/equipment/components/FansTable.tsx src/features/equipment/components/FansTableSlot.tsx src/features/equipment/components/HotWaterHeatersTable.tsx src/features/equipment/components/HotWaterHeatersTableSlot.tsx src/features/equipment/components/HotWaterTanksTable.tsx src/features/equipment/components/HotWaterTanksTableSlot.tsx src/features/equipment/components/ElectricHeatersTable.tsx src/features/equipment/components/ElectricHeatersTableSlot.tsx src/features/equipment/components/AppliancesTable.tsx src/features/equipment/components/AppliancesTableSlot.tsx src/features/assets/thermal-bridges/ThermalBridgesTable.tsx src/features/assets/routes/ThermalBridgesPage.tsx src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx` - passed.
- `cd frontend && pnpm exec tsc -b` - passed.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx` - passed, 19 tests after the test-helper type fix.
- `$simplify` pass completed for Phase 03. Actionable cleanup was fixed by moving reusable custom-field column helpers into the shared DataTable feature layer, bundling editable controller schema handlers, removing the `cloneElement` test pattern, and clarifying README phase wording.
- `$docs-pass` completed for Phase 03. Existing feature planning docs were the right durable home; no stable `context/` update was needed.
- `make format` - passed; no files changed.
- `make ci` - passed after recreating only the stale local `ph_navigator_v2_test` database. Backend `804 passed, 2 skipped, 1 warning`; frontend lint kept 3 existing fast-refresh warnings, Vitest `161 passed` files / `1595 passed` tests, production build passed with existing chunk-size warning.
- `graphify update .` - passed; rebuilt `graphify-out/graph.json` and `GRAPH_REPORT.md`, skipped HTML because the graph has 10,717 nodes.
- `cd backend && uv run pytest tests/test_project_document_equipment_custom_fields_phase_02.py tests/test_project_document_pumps.py tests/test_project_document_ventilators.py tests/test_project_document_fans.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_thermal_bridges.py tests/test_project_document_schema_mutation_endpoint.py` - passed, 63 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx src/features/equipment/__tests__/RoomsTable.addField.test.tsx src/features/equipment/__tests__/RoomsTable.customField.test.tsx src/features/equipment/__tests__/RoomsTable.formulaField.test.tsx src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/features/equipment/__tests__/VentilatorsTable.reuse.test.tsx src/features/equipment/__tests__/FansTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterHeatersTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterTanksTable.reuse.test.tsx src/features/equipment/__tests__/ElectricHeatersTable.reuse.test.tsx src/features/equipment/__tests__/AppliancesTable.reuse.test.tsx` - passed, 13 files / 61 tests.
- Browser smoke using local `http://localhost:5173` / `http://localhost:8000` with `codex@example.com` passed on smoke project `2aacd8ab-3c07-4c71-9a3e-10b33eb186c8`: Ventilators Add field dialog created a short-text custom field; Pumps Add field dialog created a short-text custom field, UI Add pump created a row, and a custom value persisted in the draft table; Thermal Bridges Add field dialog created a short-text custom field while the report PDF field remained visible; locked version state exposed zero active `Add field` buttons.
- Browser setup note: the local `ph_navigator_v2` dev database had stale Alembic revision `20260613_0025`; it was recreated locally, migrated to head, and seeded with `make seed-agent-user`. Backend was restarted once after the forced local DB recreation to clear stale psycopg connections.
- `$simplify` pass for Phase 04 fixed one quality finding: Formula was available in the Add field modal for every target table, but most target table components did not receive `rows_computed`. Backend responses now emit formula overlays for all target registries, frontend slice types/components pass them to shared custom-field column rendering, and focused backend/frontend regression tests pass.
- `cd backend && uv run pytest tests/test_project_document_equipment_custom_fields_phase_02.py` - passed, 26 tests after recreating only the stale local `ph_navigator_v2_test` database.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx` - passed, 20 tests.
- `cd backend && uv run ruff check features/project_document/tables/ventilators.py features/project_document/tables/fans.py features/project_document/tables/hot_water_heaters.py features/project_document/tables/hot_water_tanks.py features/project_document/tables/electric_heaters.py features/project_document/tables/appliances.py features/project_document/tables/thermal_bridges.py tests/test_project_document_equipment_custom_fields_phase_02.py` - passed.
- `cd backend && uv run ty check features/project_document/tables/ventilators.py features/project_document/tables/fans.py features/project_document/tables/hot_water_heaters.py features/project_document/tables/hot_water_tanks.py features/project_document/tables/electric_heaters.py features/project_document/tables/appliances.py features/project_document/tables/thermal_bridges.py tests/test_project_document_equipment_custom_fields_phase_02.py` - passed.
- `cd frontend && pnpm exec eslint src/features/equipment/types.ts src/features/equipment/components/VentilatorsTable.tsx src/features/equipment/components/PumpsTable.tsx src/features/equipment/components/FansTable.tsx src/features/equipment/components/HotWaterHeatersTable.tsx src/features/equipment/components/HotWaterTanksTable.tsx src/features/equipment/components/ElectricHeatersTable.tsx src/features/equipment/components/AppliancesTable.tsx src/features/assets/thermal-bridges/ThermalBridgesTable.tsx src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx` - passed.
- `cd frontend && pnpm exec tsc -b` - passed.

## Phase Ledger

| Phase | Status | Exit Evidence |
| --- | --- | --- |
| 01 - Backend registry pilot | Complete | `pumps_contract.field_registry=pumps_field_registry`; focused Pumps tests pass. |
| 02 - Backend registry rollout | Complete | All remaining target contracts publish registries; focused Phase 02 backend tests pass. |
| 03 - Frontend affordance wiring | Complete | Target tables render custom columns, expose active add-field affordances in editor mode, and focused frontend tests pass. |
| 04 - Verification and closeout | Complete | Focused tests, browser smoke, `make format`, `make ci`, and `graphify update .` pass. |
