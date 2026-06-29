---
DATE: 2026-06-29
TIME: 16:52 EDT
STATUS: Complete - stale draft ETag fix implemented, verified, and ready to archive.
AUTHOR: Codex
SCOPE: Same editor session writes across multiple slice-backed DataTable pages, starting with Equipment Fans -> Hot-water Tanks.
RELATED:
  - PRD.md
  - PLAN.md
  - STATUS.md
  - phases/
  - context/technical-requirements/data-table.md
  - context/technical-requirements/save-versioning.md
  - frontend/src/features/project_document/table-slice.ts
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
  - frontend/src/features/equipment/routes/EquipmentPage.tsx
  - frontend/src/features/equipment/routes/EquipmentPageBody.tsx
---

# Equipment Draft ETag Coordination

## Scope

Fix the regression where a user can edit one Equipment table, leave the draft
unsaved, switch to another Equipment sub-tab, and hit:

```text
The Hot Water Tanks draft changed in another tab. Reload the draft before editing.
```

The reported reproduction is:

1. open `Equipment / Fans`,
2. add/edit a Fan,
3. do not `Save Version`,
4. open `Equipment / Hot-water tanks`,
5. add/edit a Hot Water Tank,
6. receive `409 draft_etag_mismatch`.

The planned fix should apply to all slice-backed DataTable routes that share
the generic `createTableSliceFeature` and `useSliceTableController` path, not
only Fans and Hot Water Tanks.

## Root Cause Summary

The backend uses whole-draft optimistic concurrency: every table replacement
consumes and bumps the same document-level `draft_etag`.

The frontend performance change on 2026-06-25 intentionally stopped eager
refetches of every mounted sibling editor table slice after a write. That
removed heavy Equipment edit churn, but it left sibling table slices with stale
`draft_etag` guards while still mounted under `EquipmentPage`.

Current evidence:

- `EquipmentPage.tsx` loads all non-heat-pump Equipment slices at once.
- `EquipmentPageBody.tsx` constructs controllers for every Equipment sub-tab
  and renders only the active one.
- `table-slice.ts` updates the accepted table slice, then invalidates sibling
  editor slices with `refetchActiveSlices: false`.
- `useSliceTableController.ts` builds the next write payload from its current
  `slice` prop and sends it immediately through the mutation.
- `draftWriteHeaders(current)` sends `If-Match: current.draft_etag` when a
  draft exists.
- `write_spine.py` correctly rejects stale `If-Match` with
  `draft_etag_mismatch`.

So the bug is not "multiple Equipment pages cannot be edited." The bug is that
the second Equipment table writes with a stale document-level guard that was
invalidated by the first table write.

## Design Goal

Preserve the June 25 performance win: one cell edit must not eagerly refetch
six inactive Equipment tables.

Restore the data contract: the next write from any invalidated sibling table
must use a fresh document-level guard, and the payload should be built from the
fresh target slice.

## Read Order

1. `PRD.md` - behavior contract and acceptance criteria.
2. `PLAN.md` - implementation sequence and test strategy.
3. `STATUS.md` - current state and next step.
4. `phases/phase-00-reproduce-and-root-cause.md`.
5. `phases/phase-01-fresh-target-slice-before-write.md`.
6. `phases/phase-02-regression-coverage.md`.
7. `phases/phase-03-browser-and-performance-verification.md`.

## Phase Map

| Phase | State | Title | Purpose | Success Gate |
|---|---|---|---|---|
| P00 | Complete | Reproduce and root cause | Capture failing network/header sequence and confirm no backend behavior change is needed | Evidence shows first table write bumps `draft_etag`; second table write sends stale guard from cached sibling slice |
| P01 | Complete | Fresh target slice before write | Add a generic freshness gate before payload construction for invalidated editor table slices | Sequential writes across two mounted sibling tables use the latest `draft_etag` without eager sibling refetch |
| P02 | Complete | Regression coverage | Add focused unit and e2e coverage for stale sibling writes | Tests fail on current code and pass after P01 |
| P03 | Complete | Browser and performance verification | Smoke the reported route and verify the June 25 perf fix is not undone | Fans -> Hot-water Tanks and Pumps -> Appliances pass in-browser; request guard shows no eager sibling GET fan-out and exactly one target refresh before second write |

## Out Of Scope

- Backend merge semantics for concurrent browser tabs.
- Field-level conflict resolution after true overlapping writes.
- Changing Save / Save As lifecycle.
- Reworking Equipment sub-tab routing or table layout.
- Reverting the frontend performance work by restoring eager sibling refetches.
