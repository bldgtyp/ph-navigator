---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Planned - phased implementation sequence.
AUTHOR: Codex
SCOPE: Implementation and verification plan for stale sibling table draft ETags.
RELATED:
  - README.md
  - PRD.md
  - STATUS.md
  - phases/phase-00-reproduce-and-root-cause.md
  - phases/phase-01-fresh-target-slice-before-write.md
  - phases/phase-02-regression-coverage.md
  - phases/phase-03-browser-and-performance-verification.md
---

# Implementation Plan

## Working Hypothesis

The regression was introduced by the frontend performance change that changed
generic accepted table writes from eager sibling refetch to invalidation only:

```ts
invalidateProjectDocumentEditorTableSlices(queryClient, projectId, slice.version_id, {
  excludeTableName: acceptedTableName,
  refetchActiveSlices: false,
})
```

That is directionally correct for performance, but incomplete for write
freshness. The next write from an invalidated sibling table must refresh the
target slice before payload construction and mutation.

## Preferred Fix

Add a generic "fresh writable slice" seam in the slice-backed DataTable stack:

1. Keep accepted writes updating the source table cache immediately.
2. Keep sibling editor slices invalidated with `refetchActiveSlices: false`.
3. Before any `useSliceTableController` write builds its payload, resolve a
   current target slice:
   - if the editor slice query is not invalidated, use the current prop slice;
   - if the editor slice query is invalidated, fetch/refetch only that target
     slice;
   - build the payload from the fresh target slice;
   - send headers from that fresh target slice.
4. Apply the same freshness seam to:
   - cell/paste/fill writes,
   - row insert/delete/duplicate,
   - legacy option replacement,
   - typed custom-field schema mutation.

This is safer than only patching sibling cache metadata with the new
`draft_etag`, because the payload should not be built from a stale target table
snapshot.

## Candidate Code Shape

The exact API should follow existing local patterns, but the likely seam is:

- extend `createTableSliceFeature(...)` with a hook or helper that can resolve
  the fresh editor slice for a specific project/version/table query;
- pass that resolver into `useSliceTableController`;
- wrap payload builder calls in the controller so freshness happens before
  payload construction, not only inside the mutation.

The controller already owns every shared table write branch, so this keeps the
behavior generic instead of patching only Equipment.

## Phase Sequence

1. P00 - Reproduce and root cause.
   - Capture failing request sequence locally or with a deterministic unit
     harness.
   - Confirm first write response contains a new `draft_etag`.
   - Confirm second write request uses the old guard.
   - Confirm backend rejection is expected.

2. P01 - Fresh target slice before write.
   - Add the generic freshness seam.
   - Rebuild write payloads from the fresh target slice.
   - Keep sibling invalidation lazy.
   - Preserve current conflict handling for true stale writes.

3. P02 - Regression coverage.
   - Add a focused React Query/unit test around invalidated sibling slice
     writes.
   - Add controller-level coverage proving payload builders receive the fresh
     target slice.
   - Add Playwright table-regression coverage for the reported workflow.

4. P03 - Browser and performance verification.
   - Run focused frontend tests.
   - Run the new e2e spec against the local app.
   - Smoke the reported route with `codex@example.com`.
   - Compare network requests to ensure no return to eager sibling refetch.

## Test Commands

Expected focused commands after implementation:

```bash
cd frontend && pnpm exec vitest run src/features/project_document/table-slice.test.ts
cd frontend && pnpm exec vitest run src/shared/ui/data-table/feature/useSliceTableController.test.tsx
cd frontend && pnpm exec playwright test tests/e2e/table-regression --grep @table-draft-etag
make frontend-dev-check
```

If the change touches shared table semantics beyond the focused seam, broaden
to:

```bash
cd frontend && pnpm run test:e2e:tables
make ci
```

## Risks

- Refetching after payload construction would fix headers but can still submit
  stale rows. Avoid that.
- Refetching every sibling table after every edit would fix correctness but
  regress the June 25 Equipment performance work. Avoid that.
- Only Equipment-specific code would leave Spaces, Thermal Bridges, and
  heat-pump leaf tables exposed. Keep the fix generic.
- Tests that assert "invalidated but not refetched" should be updated to also
  assert "refetched on next write," not deleted.
