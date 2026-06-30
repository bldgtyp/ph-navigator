---
DATE: 2026-06-29
TIME: 21:55 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8)
SCOPE: Seed each per-table editor slice cache from one batch read on mount,
  removing the initial fan-out WITHOUT changing the write/coordination path.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ./phase-00-preflight-and-spike.md
---

# Phase 02 — Frontend batch-seed (preserve PR #18)

## Goal

On an editor page, fetch all tables once (`GET …/draft/tables?names=…`) and seed
each per-table editor slice query cache **before** its `useSliceQuery` would GET,
so the 7 initial `…/draft/tables/<type>` requests collapse to 1. Leave
`applyAcceptedSlice`, `invalidateProjectDocumentEditorTableSlices`, and
`resolveSliceForWrite` **unchanged** — the seed is additive around them.

This is the high-care phase. The acceptance bar is: the
`table-draft-etag-coordination.spec.ts` e2e stays green (cross-table edit works,
no false stale-draft blocker).

## Precedent — the shipped table-views batch

The sibling `batch-table-views-endpoint` (archived
`planning/archive/dated/2026-06-29/batch-table-views-endpoint/`) shipped the same
page-level-prefetch goal. **Reuse:** its backend `?keys=` collection-route
convention (here `?names=`) and its provider mount point — `EquipmentPage.tsx`,
where the slice queries fire. **Do NOT reuse** its frontend mechanism: it used a
React **context read-through** because `useProjectTableViewState` is hand-rolled;
the draft slices are TanStack Query, so seed the query cache with
`setQueryData` (below). Different seam, same shape.

## Preferred Implementation Shape

Use the **exact** mechanism the Phase 00 spike validated. The shape below is the
expected outcome; defer to the spike's findings if they differ.

1. **API** — document API layer, add
   `fetchDraftTablesBatch(projectId, versionId, names, signal) ->
   Record<string, TSlice>` hitting `…/versions/${versionId}/draft/tables?names=…`
   and returning the response's `tables` map.

2. **Slice query key helper** — reuse the existing editor slice key from
   `createTableSliceFeature.queryKeys.slice(projectId, versionId, "editor")`
   (the canonical key:
   `["project-document-tables","project",pid,"table",tableName,"slice",versionId,"editor"]`).
   Do not hand-build it; export/use the factory's helper so the seed key always
   matches what `useSliceQuery` reads.

3. **Prevent the seed from refetching on mount** (the trap — `useSliceQuery` has
   no `staleTime` today):
   - Add a `staleTime` to `useSliceQuery`'s `useQuery` config (value from the
     spike; likely long/`Infinity`). Rationale verified in Phase 00:
     `invalidateQueries` marks `isInvalidated` **independent of `staleTime`**, and
     `resolveSliceForWrite` keys on `isInvalidated`, so refetch-before-write still
     fires — #18 is preserved.
   - If the spike showed a mount/seed race (table GETs before the batch lands),
     also gate `useSliceQuery`'s `enabled` on "no batch in-flight for this key"
     via the batch context, so the per-table query stays idle until the seed
     exists, then reads it fresh.

4. **Batch provider** — a page-scoped provider (e.g.
   `ProjectDraftTablesSeedProvider({ projectId, versionId, tableNames, enabled })`)
   that, on mount, fetches the batch once and `queryClient.setQueryData(sliceKey,
   tables[name])` for each name (with a current `dataUpdatedAt` so it reads
   fresh). Expose an `isSeeding` flag for the optional `enabled` gate in (3).

5. **Fallback preserved (non-negotiable):** any table not seeded (no provider,
   deep-link, a name absent from the batch) must still fetch per-table exactly as
   today. The seed is an optimization layer, never a requirement for correctness.

6. **Mount the provider per page**, passing the page's mounted table set
   (from Phase 00): equipment first — at
   `frontend/src/features/equipment/routes/EquipmentPage.tsx`, **not**
   `EquipmentPageBody.tsx`. The 7 `useXxxSliceQuery` calls (the GETs to collapse)
   fire in `EquipmentPage.tsx`; `EquipmentPageBody` only receives the resolved
   `.data` as props, so seeding there would be too late to suppress the GETs.
   This is also where the shipped table-views batch mounted its provider. Then
   spaces and assets/ThermalBridges. The per-table fallback means a
   not-yet-wrapped page simply keeps fanning out (correct, just unoptimized) — so
   this lands page-by-page.

## Do NOT touch

- `applyAcceptedSlice` / `invalidateProjectDocumentEditorTableSlices`
  (`table-slice.ts`) — the invalidate-others-on-write protocol.
- `resolveSliceForWrite` / `commitPayloadOrThrow` / `commitSchemaMutation`
  (`useSliceTableController.ts`) — the refetch-before-write protocol.
- The per-table GET/PUT/POST endpoints. `resolveSliceForWrite`'s refetch must
  stay **per-table** (one fresh table), never a batch refetch.

## Code Areas

- document API layer (new `fetchDraftTablesBatch`)
- `frontend/src/features/project_document/table-slice.ts` (`useSliceQuery`
  `staleTime` / optional `enabled` gate; export the slice-key helper if not
  already)
- new batch-seed provider module under `frontend/src/features/project_document/`
- `frontend/src/features/equipment/routes/EquipmentPage.tsx` (the slice-query
  call site; + spaces / thermal-bridges page routes)
- tests: `frontend/src/features/project_document/__tests__/` and the e2e suite

## Tests / Acceptance

- **Unit:** with the provider seeding `pumps`, mounting the pumps
  `useSliceQuery` returns the seeded slice and issues **zero**
  `…/draft/tables/pumps` GETs (network spy asserts 0). An un-seeded key still
  GETs once (fallback).
- **Unit:** after `applyAcceptedSlice` invalidates a seeded sibling,
  `resolveSliceForWrite` still triggers a single per-table refetch for that
  sibling before its write (the #18 path, unchanged by seeding/staleTime).
- **e2e — HARD GATE:** `table-draft-etag-coordination.spec.ts` passes. Edit table
  A → switch to mounted table B → edit B succeeds with no false stale-draft
  block. Update the spec's *initial-load* network expectations for the batch
  (1 request not 7) **only** if needed, and **never** weaken the write-path
  coordination assertion. Add an explicit assertion that the cross-table write
  still works after a seeded load.
- `pnpm run format` clean; `make frontend-dev-check` + the e2e green.

## Hard stop

If no seeding mechanism keeps the e2e green without weakening the coordination
assertion, **abandon the collapse**. The perf win (≤6 round-trips on a 37 KB,
zero-jank page) is not worth reintroducing the cross-table edit bug.
