---
DATE: 2026-06-24
TIME: 22:08 EDT
STATUS: Complete - model stage payload split implemented and measured
AUTHOR: Codex
SCOPE: Model viewer lazy chunk payload investigation and split plan
RELATED:
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04-ranking.md
  - planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24.md
  - planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24-phase-04c.md
  - frontend/src/features/projects/components/ProjectTabContent.tsx
  - frontend/src/features/model_viewer/routes/ModelTab.tsx
---

# Phase 04C - Model Payload

## Goal

Reduce the Model tab lazy chunk only after the main app/project route payload has been split and re-measured.

Primary before number:

- `assets/ModelTab-st-s-3xR.js`: 350.06 kB gzip.
- after Phase 04B route split: `assets/ModelTab-B6gf8QNJ.js`: 350.29 kB gzip.

Runtime context:

- Model stress: LCP 196 ms, scripted interaction 264 ms, 1 long task, 0 React update commits.

## Breadcrumbs

- `frontend/src/features/projects/components/ProjectTabContent.tsx:11` lazy-loads `ModelTab`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:54` renders the Model tab branch.
- `planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24.md` records the 350.06 kB gzip lazy chunk.

## Phase Plan

### 1. Inspect the Existing Lazy Chunk

Use the visualizer output to identify whether the chunk is dominated by:

- three.js / rendering vendors
- model parsing utilities
- viewer UI code
- shared project-document/data-table code pulled across a boundary

Exit condition: list the top modules by gzip/parsed size before editing.

Result:

- The initial `ModelTab` lazy chunk was dominated by the active viewer stack
  (`three`, render/load helpers, material factories, and scene code).
- A first split of `ModelViewerStage` alone reduced the route shell to
  199.41 kB gzip, but the shell still imported `three` through theme/store
  helpers.
- Splitting route-safe state helpers (`themeState`, `measureDistance`) and
  data color tokens (`colorTokens`) removed the remaining accidental `three`
  path from the route shell.

### 2. Keep the Viewer Boundary Coherent

Do not split code needed for the first visible model render unless the loaded route still paints quickly.

Candidate splits:

- vendor chunk for stable 3D dependencies, if cache behavior benefits repeated model visits.
- optional tools/panels loaded after the canvas is visible.
- parser helpers loaded only when a model payload exists.

Avoid splitting:

- code required for route shell error/loading states.
- code required for first canvas mount.
- tiny modules where async overhead exceeds payload benefit.

Result:

- `ModelTab` lazy-loads `ModelViewerStage` only for an active file and preloads
  that stage only once an active model file exists.
- Model route parsing and store defaults now use `themeState`, which does not
  import render/theme material code.
- `colors.ts` remains the material-factory boundary that imports `three`;
  `colorTokens.ts` preserves the persisted/rendered color constants for
  route-safe consumers.

### 3. Re-Measure Model Route

Compare:

- Model lazy chunk gzip.
- first Model tab LCP.
- scripted interaction time.
- long tasks during route mount.
- whether the 3D scene still renders and remains interactive.

Measured result:

- Model route shell: 350.29 kB gzip after Phase 04B -> 7.00 kB gzip.
- Active 3D scene stack: `assets/ModelViewerStage-Bu_u64p4.js` at 345.06 kB
  gzip.
- Main route chunk remains 94.12 kB gzip.
- Perf matrix Model row after Phase 04C: interaction 272 ms, LCP 344 ms,
  0 long tasks, max long task 0 ms, 0 React update commits.

## Verification

- `cd frontend && pnpm run analyze`
- `cd frontend && pnpm run check:sizes`
- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- Browser smoke on `/projects/:projectId/model`.

Verification completed:

- `cd frontend && pnpm run analyze` passed; produced
  `ModelTab-COXU4CvF.js` at 7.00 kB gzip and
  `ModelViewerStage-Bu_u64p4.js` at 345.06 kB gzip.
- `cd frontend && pnpm run check:sizes` passed.
- `make frontend-dev-check` passed with existing fast-refresh warnings only.
- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
  passed 11/11, including the Model route.

## Stop Conditions

- Stop if the route split increases Model LCP or creates blank canvas states.
- Stop if the chunk is dominated by irreducible three.js/vendor code and the runtime metrics remain clean.
- Stop if payload changes require viewer behavior changes.

Stop decision:

- Stop before manual chunks. The remaining active-viewer chunk is the coherent
  3D scene stack, while the route shell/no-file state no longer pays that cost.
