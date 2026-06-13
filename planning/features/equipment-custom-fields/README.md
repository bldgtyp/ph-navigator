---
DATE: 2026-06-13
TIME: 09:21 EDT
STATUS: Active
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
4. Current implementation references:
   - `frontend/src/features/equipment/components/RoomsTableSlot.tsx`
   - `frontend/src/features/equipment/components/RoomsTable.tsx`
   - `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
   - `frontend/src/shared/ui/data-table/feature/useCustomFieldHandlers.ts`
   - `backend/features/project_document/tables/rooms.py`
   - target table contracts under `backend/features/project_document/tables/`

## Current Finding

This is not only a frontend prop-forwarding task. The shared controller
already exposes schema-mutation handlers for the target tables, but the
backend contracts currently do not opt most target tables into
custom-field mutation support. Several contracts publish
`field_registry=None`; Pumps has a registry scaffold but intentionally
routes schema mutation to a rejection helper and still publishes
`field_registry=None`.

Implementation should first make the backend table contracts actually
support custom fields, then expose the existing Rooms-style UI handlers.
