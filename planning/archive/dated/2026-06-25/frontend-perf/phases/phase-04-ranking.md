---
DATE: 2026-06-24
TIME: 22:32 EDT
STATUS: Complete - ranking implemented through Phase 04D
AUTHOR: Codex
SCOPE: Phase 4 ranking for the frontend performance refactor after static, runtime, and render profiling
RELATED:
  - planning/archive/dated/2026-06-25/frontend-perf/README.md
  - planning/archive/dated/2026-06-25/frontend-perf/PLAN.md
  - planning/archive/dated/2026-06-25/frontend-perf/STATUS.md
  - planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24.md
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04a-datatable-edit-churn.md
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04b-route-payload-splits.md
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04c-model-payload.md
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04d-secondary-runtime.md
---

# Phase 4 Ranking

This ranking was implemented through Phase 04D.

## Input Evidence

- Bundle analyzer: `assets/index-C-de3sCl.js` is 391.28 kB gzip, above the 250 kB warning threshold.
- Bundle analyzer: `assets/ModelTab-st-s-3xR.js` is 350.06 kB gzip, above the 250 kB warning threshold.
- Stress fixture: `PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`.
- Spaces stress edit: LCP 184 ms, scripted interaction 2,033 ms, 5 long tasks, max long task 208 ms, 25 React update commits, 446.1 ms total actual render.
- Equipment stress edit: LCP 192 ms, scripted interaction 3,152 ms, 5 long tasks, max long task 263 ms, 28 React update commits, 565.3 ms total actual render.
- Catalog hover pass: 274-281 ms scripted hover, 2-3 long tasks per route, 0 React update commits.
- Envelope stress: LCP 928 ms, scripted interaction 289 ms, 0 long tasks, 3 React update commits, 15.1 ms total actual render.
- Apertures stress: scripted interaction 275 ms, 1 long task, 4 React update commits, 6.4 ms total actual render.
- Model stress: LCP 196 ms, scripted interaction 264 ms, 1 long task, 0 React update commits.

## Rank Table

| Rank | Track | Priority | Why Now | Main Breadcrumbs |
| --- | --- | --- | --- | --- |
| 1 | Shared DataTable edit churn | P0 | Worst measured user-blocking work: Spaces and Equipment are both slow, both show multiple long tasks, and both show heavy React update commits. The affected code is shared, so one fix can help multiple project-document tables. | `frontend/src/shared/ui/data-table/DataTable.tsx:153`, `frontend/src/shared/ui/data-table/DataTable.tsx:190`, `frontend/src/shared/ui/data-table/DataTable.tsx:275`, `frontend/src/shared/ui/data-table/hooks/useGridEdit.ts:186`, `frontend/src/shared/ui/data-table/feature/useSliceTableController.ts:272` |
| 2 | Top-level route payload splits | P1 | The main route chunk is already over the budget before any project tab is selected. This is likely lower-risk than edit-pipeline work and can be done independently, but it addresses load payload rather than the worst interaction latency. | `frontend/src/app/router.tsx:4`, `frontend/src/app/router.tsx:17`, `frontend/src/app/router.tsx:21`, `frontend/src/app/router.tsx:38`, `frontend/src/app/router.tsx:41` |
| 3 | Project-tab payload splits | P1 | `ProjectTabContent` lazy-loads only Climate and Model. Status, Apertures, Spaces, Equipment, Thermal Bridges, and Envelope still enter the project-shell payload eagerly. This is adjacent to Rank 2 and should usually follow the router split in the same implementation window. | `frontend/src/features/projects/components/ProjectTabContent.tsx:2`, `frontend/src/features/projects/components/ProjectTabContent.tsx:11`, `frontend/src/features/projects/components/ProjectTabContent.tsx:17`, `frontend/src/features/projects/components/ProjectTabContent.tsx:21` |
| 4 | Status markdown split | P2 | `react-markdown` and `rehype-sanitize` are imported synchronously for status descriptions. This is a clean split candidate, but smaller than the route-level page imports and less directly tied to measured interaction pain. | `frontend/src/features/project_status/components/StatusDescription.tsx:2`, `frontend/src/features/project_status/components/StatusDescription.tsx:3`, `frontend/src/features/project_status/components/StatusDescription.tsx:12` |
| 5 | Model viewer payload | P2 | The Model lazy chunk is 350.06 kB gzip, but the runtime pass did not show matching interaction pain. Defer until after the app/project route boundaries, unless model load becomes the user-facing target. | `frontend/src/features/projects/components/ProjectTabContent.tsx:11`, `frontend/src/features/projects/components/ProjectTabContent.tsx:54` |
| 6 | Envelope first-view trace | P3 | Envelope has the highest measured LCP at 928 ms, but no long tasks and only 15.1 ms of React render. This needs a focused LCP attribution trace before refactor work. | `planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24.md` |
| 7 | Catalog hover long tasks | P3 | Catalog hover routes have small scripts, zero React commits, and modest long tasks. Keep as secondary unless regressions appear after route splitting or shared table changes. | `planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24.md` |

## Decision

Start implementation with Rank 1 unless the desired next step is a quick payload win. Rank 1 addresses the largest measured interactive cost and covers the shared DataTable surfaces used by Spaces, Rooms, Equipment, and catalog-style tables.

Ranks 2-4 can be batched as a route-payload phase because they share the same implementation pattern: `React.lazy`, `Suspense`, route-level fallbacks, and post-change bundle analysis. Keep that separate from DataTable edit work so measured wins remain attributable.

Rank 5 should not be mixed into the initial route split. The existing Model tab is already lazy-loaded; its remaining issue is vendor/viewer payload inside that lazy boundary.

Ranks 6-7 were resolved in Phase 04D as metrics-backed attribution work. The
catalog hover signal was a harness attribution issue; the Envelope LCP signal
was a recovered-draft message, so no production refactor was promoted.

## Implementation Sequence

1. Phase 04A: isolate and reduce shared DataTable edit churn.
2. Phase 04B: split top-level routes and project tabs, then re-check main bundle gzip.
3. Phase 04C: inspect and split Model viewer payload only after the app/project route split.
4. Phase 04D: run focused traces for Envelope LCP and catalog hover long tasks before deciding whether to refactor.

## Non-Goals

- Do not replace the slice-backed DataTable architecture in Phase 04A.
- Do not change table semantics: undo/redo, custom fields, linked records, formula fields, unit rendering, and stale-draft conflict handling must remain intact.
- Do not combine route payload splitting with DataTable edit pipeline changes in the same implementation patch.
- Do not chase manual chunks before route boundaries have been measured.
