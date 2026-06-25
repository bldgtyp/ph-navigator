---
DATE: 2026-06-24
TIME: 21:13 EDT
STATUS: Planned - implementation not started
AUTHOR: Codex
SCOPE: Shared DataTable edit-pipeline performance plan for Spaces and Equipment stress edits
RELATED:
  - planning/refactor/frontend-perf/phases/phase-04-ranking.md
  - planning/refactor/frontend-perf/scorecard-2026-06-24.md
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/hooks/useGridEdit.ts
  - frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
  - frontend/src/features/equipment/routes/RoomsPage.tsx
  - frontend/src/features/equipment/routes/EquipmentPageBody.tsx
  - frontend/src/features/spaces/routes/SpaceTypesPage.tsx
---

# Phase 04A - DataTable Edit Churn

## Goal

Reduce the measured edit interaction cost on shared DataTable surfaces without changing table behavior.

Primary before numbers:

- Spaces stress edit: 2,033 ms scripted interaction, 5 long tasks, 208 ms max long task, 25 React update commits, 446.1 ms actual render.
- Equipment stress edit: 3,152 ms scripted interaction, 5 long tasks, 263 ms max long task, 28 React update commits, 565.3 ms actual render.

## Working Theory

The slow path is not a single component. It is a full edit pipeline:

1. `DataTable` derives filtered rows, duplicate identifiers, aggregate groups, body plan, visible rows, row ids, and editing state at the table root.
2. `useGridEdit.commit` builds a write plan and awaits the shared write reducer.
3. `useGridWriteReducer.dispatchWrite` awaits `onWrite`.
4. `useSliceTableController.onWrite` converts cell writes into a whole-slice replacement payload.
5. The feature route receives the new slice and re-runs table/schema/linked-record derivations.

The first implementation step should prove which part dominates before changing structure.

## Breadcrumbs

- `frontend/src/shared/ui/data-table/DataTable.tsx:153` computes `filteredRows`.
- `frontend/src/shared/ui/data-table/DataTable.tsx:166` computes duplicate identifier state.
- `frontend/src/shared/ui/data-table/DataTable.tsx:178` computes grouped aggregate paths.
- `frontend/src/shared/ui/data-table/DataTable.tsx:190` computes `bodyPlan`.
- `frontend/src/shared/ui/data-table/DataTable.tsx:226` computes `visibleDataRows`.
- `frontend/src/shared/ui/data-table/DataTable.tsx:233` computes `rowIds`.
- `frontend/src/shared/ui/data-table/DataTable.tsx:275` wires `useGridWriteReducer`.
- `frontend/src/shared/ui/data-table/DataTable.tsx:316` wires `useGridEdit`.
- `frontend/src/shared/ui/data-table/DataTable.tsx:702` consumes pending edit state after row-id changes.
- `frontend/src/shared/ui/data-table/DataTable.tsx:711` starts inline edits.
- `frontend/src/shared/ui/data-table/DataTable.tsx:738` clears active cells by dispatching writes.
- `frontend/src/shared/ui/data-table/hooks/useGridEdit.ts:186` starts the generic commit path.
- `frontend/src/shared/ui/data-table/hooks/useGridEdit.ts:213` awaits `dispatchWrite`.
- `frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts:36` starts `dispatchWrite`.
- `frontend/src/shared/ui/data-table/hooks/useGridWriteReducer.ts:39` awaits `onWrite`.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts:246` builds `commitPayloadOrThrow`.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts:253` calls `replaceMutation.mutateAsync`.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts:272` starts `onWrite`.
- `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts:282` converts cell/paste/fill writes into replacement payloads.
- `frontend/src/features/equipment/routes/RoomsPage.tsx:117` wires `useRoomDialogController` and the room table controller.
- `frontend/src/features/equipment/routes/RoomsPage.tsx:133` rebuilds the formula registry from controller field defs.
- `frontend/src/features/equipment/routes/RoomsPage.tsx:138` rebuilds linked-record ops from field defs, pumps, and space types.
- `frontend/src/features/equipment/components/RoomsTable.tsx:178` renders the Rooms `DataTable`.
- `frontend/src/features/spaces/routes/SpaceTypesPage.tsx:111` wires the Space-Types slice controller.
- `frontend/src/features/spaces/routes/SpaceTypesPage.tsx:135` also wires the Rooms dialog controller for inverse-link edits.
- `frontend/src/features/spaces/routes/SpaceTypesPage.tsx:202` writes inverse-link selections through `roomDialog.controller.onWrite`.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:136` builds previews for every equipment slice.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:250` wires the Ventilators controller.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:270` wires the Pumps controller.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:290` wires the Fans controller.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:310` wires the Hot Water Heaters controller.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:329` wires the Hot Water Tanks controller.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:348` wires the Electric Heaters controller.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:367` wires the Appliances controller.
- `frontend/src/features/equipment/routes/EquipmentPageBody.tsx:440` renders only the active equipment table.
- `frontend/src/features/equipment/components/AppliancesTable.tsx:212` renders the Appliances `DataTable`.

## Phase Plan

### 1. Reproduce and Narrow

- Re-run only the perf targets needed for Spaces and Equipment against `PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`.
- Capture React commit counts by route and action before edits.
- Add temporary profiler labels only if the root `reactCommits` data cannot distinguish `DataTable`, active table rows, controller shell, and feature route recomputation.
- Capture network request counts and changed query keys during one cell edit.

Exit condition: identify whether most time is active table render, inactive Equipment controller recomputation, mutation/refetch/query invalidation, or derived row-model churn.

### 2. Stabilize Active Table Inputs

Candidate changes, in order of caution:

- Keep `rows`, `columnDefs`, `fieldDefs`, `view`, and action callbacks stable where the feature route already has enough data to memoize them.
- Review `DataTable` derived arrays for avoidable identity churn on single-cell edits.
- Split expensive row/body derivation into memoized helpers only where dependencies are already precise.
- Avoid moving behavior out of shared hooks unless measurement shows hook state is the render trigger.

Exit condition: repeat Spaces/Equipment edit measurements show fewer commits or lower total actual render without behavior diffs.

### 3. Isolate Inactive Equipment Work

Equipment is a special case because `EquipmentPageBody` builds previews/controllers for every non-heat-pump tab before rendering one active table.

Candidate changes:

- Measure whether inactive controllers rerender during active-table edits.
- If confirmed, defer inactive controller construction behind active-tab branches or component boundaries.
- Preserve tab switch behavior, draft-restored banners, conflict handling, and `?tab=` / `?focus=` navigation.

Exit condition: Equipment edit cost drops without changing sub-tab routing or draft conflict state.

### 4. Review Write Completion Semantics

Do not optimistically change persistence semantics first. The current path closes editing state after `dispatchWrite` resolves, and `dispatchWrite` awaits `onWrite`.

Candidate changes only after measurement:

- Avoid redundant refetches when mutation response already contains the accepted slice.
- Patch React Query cache from accepted mutation results where existing hooks already support it.
- Consider decoupling editor close from server acknowledgment only if error handling and stale-draft behavior remain explicit.

Exit condition: no stale ETag regressions, no undo/redo regressions, no lost error messages.

## Guardrails

- Preserve undo/redo stack semantics in `useGridWriteReducer`.
- Preserve linked-record pills, inverse-link edits, and formula registry behavior.
- Preserve custom-field schema mutation behavior.
- Preserve unit-aware rendering and field overlays.
- Preserve stale-draft and version-locked conflict flows.
- Coordinate with `planning/refactor/table-write-architecture-unification/` before changing slice-write contracts.

## Verification

- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/useGridEdit.test.ts`
- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/feature/useSliceTableController.test.ts` if present after discovery.
- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- Update `planning/refactor/frontend-perf/scorecard-2026-06-24.md` or create a new dated scorecard with before/after rows.

## Stop Conditions

- Stop if the first measurement shows network latency dominates and React render is not the bottleneck for the edit action.
- Stop if the safest fix requires changing the slice API contract; move that work into a separate architecture packet first.
- Stop if a table semantics regression appears in linked records, custom fields, or undo/redo.
