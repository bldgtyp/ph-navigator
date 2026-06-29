---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Planned
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

- The reported Fans -> Hot-water Tanks workflow no longer reaches
  `draft_etag_mismatch`.
- Sibling queries remain invalidated but are not eagerly refetched after the
  first write.
- The target sibling table refetches at most once immediately before its next
  write.
- Payload builders receive the fresh target slice.
