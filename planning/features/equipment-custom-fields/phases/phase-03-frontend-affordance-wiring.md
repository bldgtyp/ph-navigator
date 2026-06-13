---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Pending
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

1. For each target table component, add optional custom-field props
   matching `RoomsTable`:
   - `onAddCustomField`
   - `onDeleteCustomField`
   - `onDuplicateCustomField`
   - `onEditCustomFieldBundle`
2. Forward those props into the underlying `DataTable`.
3. For each Equipment table slot, pass controller handlers only when
   `controller.canEdit` is true:
   - `controller.handleAddCustomField`
   - `controller.handleDeleteCustomField`
   - `controller.handleDuplicateCustomField`
   - `controller.handleEditCustomFieldBundle`
4. For Thermal Bridges, wire the same handlers from
   `ThermalBridgesPageBody` into `ThermalBridgesTable`.
5. Keep read-only states passive:
   - viewer mode omits handlers
   - locked versions omit handlers through `controller.canEdit`
   - no new one-off disabled state should be introduced
6. Preserve existing table-specific props:
   - Pumps inverse-link pill navigation
   - Ventilators linked HP indoor count
   - attachment cell `onChange` handlers
   - footer row-add buttons
   - view-state and reset wiring

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

- active "Add field" button appears for editor-mode target tables
- add-field dialog opens from the tail cell
- submit calls the provided `onAddCustomField`
- viewer / read-only mode leaves no active "Add field" button
- at least one table with attachment cells still renders and writes
  attachment values normally
- Thermal Bridges opens the add-field dialog and preserves PDF report
  attachment rendering

If test setup becomes repetitive, extract a small local helper for
rendering a table with minimal slice fixtures. Do not refactor the
production table architecture just for tests.

## Acceptance Criteria

- The disabled "Add field - coming soon" state is gone from editor-mode
  target tables.
- Rooms behavior remains unchanged.
- Target tables expose the same custom-field header actions as Rooms
  for custom fields.
- Focused frontend tests pass.

## Stop Condition

Stop after frontend wiring and focused frontend tests pass. Record
commands and results in `STATUS.md`, then proceed to Phase 04 for
browser and full-gate verification.
