---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Generic frontend fix for write-time target slice freshness.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 01 - Fresh Target Slice Before Write

## Goal

Keep lazy sibling invalidation for performance, but ensure every write from an
invalidated target table uses fresh target slice data and a fresh document
`draft_etag`.

## Preferred Implementation Shape

1. Add a generic fresh-slice resolver near `createTableSliceFeature`.
   - It should know the table query key:
     `project-document-tables / project / {projectId} / table / {tableName} / slice / {versionId} / editor`.
   - It should inspect the query state.
   - If the query is invalidated, it should fetch/refetch only that target
     table slice.
   - If the query is not invalidated, it should return the current slice.

2. Thread the resolver into `useSliceTableController`.
   - Add an optional argument such as `resolveSliceForWrite`.
   - The default behavior should preserve existing callers.
   - For generic table routes, pass the resolver.

3. Move freshness before payload construction.
   - Do not build `payloadBuilders.fromRowInsert(slice, ...)` from a stale
     slice and only refresh headers later.
   - Instead:
     - resolve fresh target slice;
     - build payload from fresh slice;
     - pass fresh slice as `current` to the mutation.

4. Apply to every write branch in the controller.
   - `cell`
   - `paste`
   - `fill`
   - `rowInsert`
   - `rowDelete`
   - `rowDuplicate`
   - `schemaMutation` with `variant: "typed"`
   - legacy single-select option replacement

5. Preserve conflict handling.
   - If the refresh itself fails with auth or version lock, use existing error
     behavior.
   - If a true external writer changes the draft after the refresh and before
     the mutation, keep the existing `draft_etag_mismatch` blocker.

## Code Areas

- `frontend/src/features/project_document/table-slice.ts`
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts`
- `frontend/src/shared/ui/data-table/feature/types.ts`
- generic table route owners:
  - `frontend/src/features/equipment/routes/EquipmentPageBody.tsx`
  - `frontend/src/features/equipment/heat-pumps/routes/HeatPumpsPanel.tsx`
  - `frontend/src/features/equipment/routes/RoomsPage.tsx`
  - `frontend/src/features/spaces/routes/SpaceTypesPage.tsx`
  - `frontend/src/features/assets/routes/ThermalBridgesPage.tsx`

## Rejected First Fix

Do not simply restore eager sibling refetches in `applyAcceptedSlice(...)`.

Reason: the 2026-06-25 performance work measured Equipment edits refetching six
inactive sibling tables after one write. The new fix should refresh only the
next table the user actually writes.

## Exit Criteria

- ✅ The shared controller now checks the target editor-slice query before each
  table write. If that query is invalidated, it refetches only that target
  slice and uses the returned slice as the write basis.
- ✅ Sibling queries still remain invalidated but are not eagerly refetched
  after an accepted write; the invalidation policy in
  `applyAcceptedSlice(...)` is unchanged.
- ✅ Payload builders for cell, paste, fill, row insert/delete/duplicate, and
  legacy option replacement receive the resolved writable slice before the
  mutation runs.
- ✅ Typed schema mutations send headers from the resolved writable slice.
- ✅ Heat-pump outdoor-unit cascade previews, which run before the controller's
  row-delete write, now use the same resolved writable slice.
- Browser proof for the reported Fans -> Hot-water Tanks workflow is deferred
  to P03 after regression coverage lands.
