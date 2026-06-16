---
DATE: 2026-06-16
TIME: 12:14 EDT
STATUS: Implemented / in review
AUTHOR: Codex
SCOPE: Render Units - Indoor Equipment and Outdoor unit as link fields
  while preserving Heat Pumps native storage.
RELATED:
  - planning/features/heat-pump-link-fields/PRD.md
  - frontend/src/features/equipment/heat-pumps/indoor-unit-columns.tsx
  - frontend/src/features/equipment/heat-pumps/components/IndoorUnitsTable.tsx
---

# Phase 02 - Indoor Unit Link Rendering

## Preconditions

- Phase 01 complete.
- D1 resolved.
- Existing Heat Pumps panel tests pass before behavior change if
  practical.

## Tasks

1. Change `indoorUnitFieldDefs`:
   - `indoor_equip_id`: `field_type: "linked_record"`,
     `target_table_path: ["equipment", "heat_pumps", "indoor_equip"]`,
     `max_links: 1`.
   - `outdoor_unit_id`: `field_type: "linked_record"`,
     `target_table_path: ["equipment", "heat_pumps", "outdoor_units"]`,
     `max_links: 1`.
   - Preserve `served_room_ids` as `target_table_path: ["rooms"]`.
2. Change `indoorUnitColumnDefs` accessors:
   - `indoor_equip_id` returns `[row.indoor_equip_id]`.
   - `outdoor_unit_id` returns `row.outdoor_unit_id ? [row.outdoor_unit_id] : []`.
3. Supply linked-record ops in `IndoorUnitsTable`:
   - one map for indoor equipment rows.
   - one map for outdoor unit rows.
   - existing map for rooms.
   - merge all maps before passing `linkedRecordOps` to `DataTable`.
4. Normalize writes in `IndoorUnitsTable.handleWrite`:
   - `indoor_equip_id`: first linked id is required; reject or no-op empty
     arrays with a clear UI error path.
   - `outdoor_unit_id`: first linked id or `null`.
   - `served_room_ids`: array as today.
5. Wire pill clicks:
   - equipment pill opens `IndoorEquipRowModal`.
   - outdoor-unit pill opens `OutdoorUnitRowModal`.
   - room pill keeps `LinkedRoomDialogHost`.
6. Keep the row-detail modal pickers functional. They may remain native
   select controls for this phase if the DataTable grid now renders
   correctly.

## Acceptance Criteria

- Screenshot-visible columns use the link icon for Equipment, Outdoor
  unit, and Rooms.
- Link pills use target row labels:
  - indoor equipment: existing `indoorEquipLabel`.
  - outdoor unit: existing `outdoorUnitLabel`.
  - rooms: existing `roomLabel`.
- Picker commits persist valid backend rows without changing JSON shape.
- Empty outdoor-unit link persists as `outdoor_unit_id: null`.
- Empty indoor-equipment link is prevented or cleanly rejected because
  the field is required.

## Stop Conditions

- Stop if the DataTable linked-record editor cannot safely represent a
  required single-link field without a shared component change.
- Stop if changing accessor values to arrays breaks sort/filter behavior
  in a way that cannot be fixed locally.

## Verification

- Focused Vitest coverage for:
  - link-field rendering of the two fields.
  - picker commit maps array values back to scalar fields.
  - pill click opens the correct local modal.
- `make frontend-dev-check`.

## Result - 2026-06-16

Implemented in:

- `frontend/src/features/equipment/heat-pumps/indoor-unit-columns.tsx`
- `frontend/src/features/equipment/heat-pumps/components/IndoorUnitsTable.tsx`
- `frontend/src/features/equipment/heat-pumps/components/IndoorUnitRowModal.tsx`
- `frontend/src/features/equipment/heat-pumps/components/OutdoorUnitRowModal.tsx`
- `frontend/src/features/equipment/heat-pumps/link-fields.ts`
- `frontend/src/features/equipment/heat-pumps/__tests__/IndoorUnitsTable.test.tsx`
- `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`

Evidence:

- `Equipment` and `Outdoor unit` now use `field_type: "linked_record"`
  with `max_links: 1`.
- Linked-record writes are normalized back to
  `indoor_equip_id: string` and `outdoor_unit_id: string | null`.
- Focused Vitest passed for link rendering and scalar PATCH payloads.
