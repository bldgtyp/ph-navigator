---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Space-Types DataTable UI, Rooms single-link picker, and reverse
  Rooms link rendering.
RELATED:
  - planning/features/spaces-refactor/PRD.md
  - frontend/src/features/equipment/components/RoomsTableSlot.tsx
  - frontend/src/features/equipment/routes/RoomsPage.tsx
  - frontend/src/shared/ui/data-table
---

# Phase 04 - Frontend Table And Link UI

## Goal

Render the new Space-Types DataTable and wire Rooms' Space Type
single-link field to that table, including reverse Rooms links on the
Space-Types side.

## Preconditions

- Phase 01 backend slice exists.
- Phase 02 backend Rooms link field and inverse overlays exist.
- Phase 03 Spaces route exists.

## Tasks

1. Add frontend Space-Types types and slice feature:
   - `SPACE_TYPES_TABLE_NAME = "space_types"`
   - `SpaceTypeRow`
   - `SpaceTypesSlice`
   - `SpaceTypesReplacePayload`
   - `spaceTypesSliceFeature`
2. Build Space-Types table components by following current equipment
   table slot/controller patterns:
   - `SpaceTypesTable.tsx`
   - `SpaceTypesTableSlot.tsx`
   - `buildEmptySpaceTypeRow.ts`
   - controller payload builders
3. Render Tag and Name columns using the shared DataTable.
4. Render read-only reverse Rooms links from `inverse_links` /
   `inverse_link_fields`. Pills should label Rooms by `Record-ID`
   formula if available, then number/name, then row id.
5. In `RoomsPage`, fetch Space-Types alongside Rooms and build
   `LinkedRecordCellOps` for the built-in `space_type_id` field.
6. Derive linked-record target options from backend metadata when
   available; remove the current hard-coded target-list pattern where
   feasible.
7. Ensure the Rooms picker enforces single-link UX for
   `max_links: 1`.
8. Add frontend tests:
   - Space-Types empty state and add-row flow;
   - Rooms Space Type cell write persists one id;
   - Rooms Space Type picker rejects/limits multiple picks;
   - Space-Types reverse Rooms column displays linked Rooms;
   - reverse Room pill navigates to `/spaces/rooms?focus=...&open=1`;
   - locked/viewer mode disables edits.

## Acceptance Criteria

- Users can create Space-Type rows with Tag and Name.
- Users can link a Room to exactly one Space-Type.
- Space-Types shows the Rooms that link to each Space-Type.
- Reverse-link pills navigate to the linked Room.
- Existing Rooms custom fields, formula fields, and linked-record custom
  fields still work.

## Stop Conditions

- Stop if linked-record UI assumes all linked fields are user-created
  `cf_*` fields and cannot render built-in `space_type_id` without a
  shared fix.
- Stop if reverse-link rendering requires duplicating row-resolution
  logic that should live in shared DataTable helpers.

## File Entry Points

- `frontend/src/features/equipment/types.ts` or a new
  `frontend/src/features/spaces/types.ts`
- `frontend/src/features/equipment/api.ts` or a new Spaces API module
- `frontend/src/features/equipment/routes/RoomsPage.tsx`
- `frontend/src/shared/ui/data-table/`
- `frontend/src/features/spaces/components/SpaceTypesTable.tsx`
- `frontend/src/features/spaces/components/SpaceTypesTableSlot.tsx`
