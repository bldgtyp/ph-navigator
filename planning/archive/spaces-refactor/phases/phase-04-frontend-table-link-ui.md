---
DATE: 2026-06-16
TIME: 15:59 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Space-Types DataTable UI, Rooms single-link picker, and reverse
  Rooms link rendering.
RELATED:
  - planning/archive/spaces-refactor/PRD.md
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

1. [x] Add frontend Space-Types types and slice feature:
   - `SPACE_TYPES_TABLE_NAME = "space_types"`
   - `SpaceTypeRow`
   - `SpaceTypesSlice`
   - `SpaceTypesReplacePayload`
   - `spaceTypesSliceFeature`
2. [x] Build Space-Types table components by following current equipment
   table slot/controller patterns:
   - `SpaceTypesTable.tsx`
   - `SpaceTypesTableSlot.tsx`
   - `buildEmptySpaceTypeRow.ts`
   - controller payload builders
3. [x] Render Tag and Name columns using the shared DataTable.
4. [x] Render read-only reverse Rooms links from `inverse_links` /
   `inverse_link_fields`. Pills should label Rooms by `Record-ID`
   formula if available, then number/name, then row id.
5. [x] In `RoomsPage`, fetch Space-Types alongside Rooms and build
   `LinkedRecordCellOps` for the built-in `space_type_id` field.
6. [x] Derive linked-record target options from backend metadata when
   available; remove the current hard-coded target-list pattern where
   feasible.
7. [x] Ensure the Rooms picker enforces single-link UX for
   `max_links: 1`.
8. [x] Add frontend tests:
   - Space-Types empty state and add-row flow;
   - Rooms Space Type cell write persists one id;
   - Rooms Space Type picker rejects/limits multiple picks;
   - Space-Types reverse Rooms column displays linked Rooms;
   - reverse Room pill navigates to `/spaces/rooms?focus=...&open=1`;
   - locked/viewer mode disables edits.

## Completion Notes

- Implemented on 2026-06-16.
- Focused tests cover Space-Types row creation/write/duplicate
  payloads, duplicate/blank Tag validation, Space-Types Tag/Name
  rendering, reverse Rooms link rendering/click callbacks, viewer
  read-only rendering, Rooms built-in Space Type linked-record rendering,
  `space_type_id` write persistence, and `max_links: 1` metadata.
- `$ simplify` cleanup extracted shared project-document table
  primitives, shared field-default readers, shared Space-Types test
  fixtures, and shared Room display-label helpers; it also stabilized
  reverse-link navigation callbacks and avoids rewriting unchanged
  Space-Type rows during cell writes.
- `$ docs-pass` made no stable `context/` edits. Phase 05 remains
  responsible for browser smoke, full verification, and durable context
  closeout.
- Full `make ci` intentionally remains deferred until Phase 05.

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
