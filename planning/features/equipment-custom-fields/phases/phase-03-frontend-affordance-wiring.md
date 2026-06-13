---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Wire active Add Field affordances into Equipment and Thermal Bridges DataTables.
RELATED: planning/features/equipment-custom-fields/phases/phase-02-backend-registry-rollout.md; frontend/src/features/equipment/components/RoomsTableSlot.tsx; frontend/src/features/equipment/components/RoomsTable.tsx; frontend/src/features/equipment/routes/EquipmentPageBody.tsx; frontend/src/features/assets/routes/ThermalBridgesPage.tsx
---

# Phase 03 - Frontend Affordance Wiring

## Goal

Expose the existing Rooms custom-field authoring affordance on all
target Equipment and Thermal Bridges tables by forwarding the shared
`useSliceTableController` schema handlers into `DataTable`.

## Preconditions

- Phase 02 is complete.
- Backend `custom-fields:mutate` support is green for every target
  table.

## Implementation Tasks

1. [x] For each target table component, add optional custom-field props
   matching `RoomsTable`:
   - `onAddCustomField`
   - `onDeleteCustomField`
   - `onDuplicateCustomField`
   - `onEditCustomFieldBundle`
2. [x] Forward those props into the underlying `DataTable`.
3. [x] For each Equipment table slot, pass controller handlers only when
   `controller.canEdit` is true:
   - `controller.handleAddCustomField`
   - `controller.handleDeleteCustomField`
   - `controller.handleDuplicateCustomField`
   - `controller.handleEditCustomFieldBundle`
4. [x] For Thermal Bridges, wire the same handlers from
   `ThermalBridgesPageBody` into `ThermalBridgesTable`.
5. [x] Keep read-only states passive:
   - viewer mode omits handlers
   - locked versions omit handlers through `controller.canEdit`
   - no new one-off disabled state should be introduced
6. [x] Preserve existing table-specific props:
   - Pumps inverse-link pill navigation
   - Ventilators linked HP indoor count
   - attachment cell `onChange` handlers
   - footer row-add buttons
   - view-state and reset wiring

Additional implementation note: the target tables now share
`customFieldColumnDefs`, the same custom-column renderer now used by
Rooms. This keeps the newly active Add Field affordance usable after
schema refetch because `tableSchema.customFields` is appended to the
rendered column list.

## Target Frontend Files

- `frontend/src/features/equipment/components/VentilatorsTable.tsx`
- `frontend/src/features/equipment/components/VentilatorsTableSlot.tsx`
- `frontend/src/features/equipment/components/PumpsTable.tsx`
- `frontend/src/features/equipment/components/PumpsTableSlot.tsx`
- `frontend/src/features/equipment/components/FansTable.tsx`
- `frontend/src/features/equipment/components/FansTableSlot.tsx`
- `frontend/src/features/equipment/components/HotWaterHeatersTable.tsx`
- `frontend/src/features/equipment/components/HotWaterHeatersTableSlot.tsx`
- `frontend/src/features/equipment/components/HotWaterTanksTable.tsx`
- `frontend/src/features/equipment/components/HotWaterTanksTableSlot.tsx`
- `frontend/src/features/equipment/components/ElectricHeatersTable.tsx`
- `frontend/src/features/equipment/components/ElectricHeatersTableSlot.tsx`
- `frontend/src/features/equipment/components/AppliancesTable.tsx`
- `frontend/src/features/equipment/components/AppliancesTableSlot.tsx`
- `frontend/src/features/assets/thermal-bridges/ThermalBridgesTable.tsx`
- `frontend/src/features/assets/routes/ThermalBridgesPage.tsx`

## Tests

Add rendered frontend tests modeled on Rooms coverage:

- [x] active "Add field" button appears for editor-mode target tables
- [x] add-field dialog opens from the tail cell
- [x] submit calls the provided `onAddCustomField`
- [x] viewer / read-only mode leaves no active "Add field" button
- [x] at least one table with attachment cells still renders and writes
  attachment values normally
- [x] Thermal Bridges opens the add-field dialog and preserves PDF report
  attachment rendering

If test setup becomes repetitive, extract a small local helper for
rendering a table with minimal slice fixtures. Do not refactor the
production table architecture just for tests.

## Acceptance Criteria

- [x] The disabled "Add field - coming soon" state is gone from editor-mode
  target tables.
- [x] Rooms behavior remains unchanged.
- [x] Target tables expose the same custom-field header actions as Rooms
  for custom fields.
- [x] Focused frontend tests pass.

## Completion Evidence

- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx src/features/equipment/__tests__/RoomsTable.addField.test.tsx` - passed, 23 tests.
- `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx src/features/equipment/__tests__/RoomsTable.addField.test.tsx src/features/equipment/__tests__/RoomsTable.customField.test.tsx src/features/equipment/__tests__/RoomsTable.formulaField.test.tsx src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx src/features/equipment/__tests__/RoomsTable.schemaEditor.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/features/equipment/__tests__/VentilatorsTable.reuse.test.tsx src/features/equipment/__tests__/FansTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterHeatersTable.reuse.test.tsx src/features/equipment/__tests__/HotWaterTanksTable.reuse.test.tsx src/features/equipment/__tests__/ElectricHeatersTable.reuse.test.tsx src/features/equipment/__tests__/AppliancesTable.reuse.test.tsx` - passed, 61 tests.
- `cd frontend && pnpm exec eslint src/shared/ui/data-table/feature/customFieldColumns.tsx src/shared/ui/data-table/feature/index.ts src/features/equipment/components/RoomsTable.tsx src/features/equipment/components/PumpsTable.tsx src/features/equipment/components/PumpsTableSlot.tsx src/features/equipment/components/VentilatorsTable.tsx src/features/equipment/components/VentilatorsTableSlot.tsx src/features/equipment/components/FansTable.tsx src/features/equipment/components/FansTableSlot.tsx src/features/equipment/components/HotWaterHeatersTable.tsx src/features/equipment/components/HotWaterHeatersTableSlot.tsx src/features/equipment/components/HotWaterTanksTable.tsx src/features/equipment/components/HotWaterTanksTableSlot.tsx src/features/equipment/components/ElectricHeatersTable.tsx src/features/equipment/components/ElectricHeatersTableSlot.tsx src/features/equipment/components/AppliancesTable.tsx src/features/equipment/components/AppliancesTableSlot.tsx src/features/assets/thermal-bridges/ThermalBridgesTable.tsx src/features/assets/routes/ThermalBridgesPage.tsx src/features/equipment/__tests__/EquipmentCustomFieldsPhase03.test.tsx` - passed.
- `cd frontend && pnpm exec tsc -b` - passed.

## Stop Condition

Phase 03 stopped after frontend wiring and focused frontend tests
passed. Phase 04 remains the next slice for browser smoke and the full
repo gate.
