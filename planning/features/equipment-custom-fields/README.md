---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Enable user-defined custom fields on Equipment and Thermal Bridges DATA-TABLES.
RELATED: context/user-stories/32-custom-fields.md; context/user-stories/30-tables-equipment.md; context/technical-requirements/data-table.md; frontend/src/features/equipment/routes/EquipmentPageBody.tsx; frontend/src/features/assets/routes/ThermalBridgesPage.tsx
---

# Equipment Custom Fields

## Scope

Wire the existing DataTable "Add field" affordance into every project-document equipment table that currently renders the disabled tail-cell:

- Ventilators / ERVs
- Pumps
- Fans
- Hot Water Heaters
- Hot Water Tanks
- Electric Heaters
- Appliances
- Thermal Bridges

Rooms is the implementation precedent. It already forwards the shared
`useSliceTableController` custom-field handlers through `RoomsTableSlot`
and `RoomsTable` into `DataTable`.

## Read Order

1. `PRD.md`
2. `PLAN.md`
3. `STATUS.md`
4. Phase closeout:
   - `phases/phase-04-verification-closeout.md`
5. Later phases:
   - None after Phase 04
6. Current implementation references:
   - `frontend/src/features/equipment/components/RoomsTableSlot.tsx`
   - `frontend/src/features/equipment/components/RoomsTable.tsx`
   - `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
   - `frontend/src/shared/ui/data-table/feature/useCustomFieldHandlers.ts`
   - `backend/features/project_document/tables/rooms.py`
   - target table contracts under `backend/features/project_document/tables/`

## Current Finding

This is not only a frontend prop-forwarding task. The shared controller
already exposes schema-mutation handlers for the target tables, but the
backend contracts previously did not opt most target tables into
custom-field mutation support. Phase 01 enabled the Pumps backend
registry pilot. Phase 02 rolled the same pattern across Ventilators,
Fans, Hot Water Heaters, Hot Water Tanks, Electric Heaters, Appliances,
and Thermal Bridges, so every target backend contract now publishes a
non-null `field_registry` and routes schema mutations through the
shared dispatcher.

Phase 03 exposed the existing Rooms-style UI handlers now that backend
support exists for all target contracts. The target table components
now append user-defined custom columns from `tableSchema.customFields`
and receive the shared DataTable schema callbacks in editable
controller states.

Phase 04 verified the feature end to end. Focused backend/frontend
tests passed, browser smoke proved Add field authoring on Pumps,
Ventilators, and Thermal Bridges, Pumps custom values persisted through
the draft table path, formula custom fields render from computed
overlays on the newly enabled target tables, and locked versions hide
schema-mutation controls. The final repo gate passed, and the branch is
ready for PR review.

## Phase Map

| Phase | Status | Handoff |
| --- | --- | --- |
| 01 - Backend registry pilot | Complete | Pumps accepts backend custom-field schema mutations through its existing registry scaffold. |
| 02 - Backend registry rollout | Complete | Remaining Equipment and Thermal Bridges contracts publish registries and pass focused backend mutation tests. |
| 03 - Frontend affordance wiring | Complete | Target table components render custom columns and receive existing controller handlers in editable states. |
| 04 - Verification and closeout | Complete | Focused tests and browser smoke pass; final repo gate evidence recorded in `STATUS.md`. |
