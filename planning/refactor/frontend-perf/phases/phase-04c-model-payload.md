---
DATE: 2026-06-24
TIME: 21:13 EDT
STATUS: Planned - implementation not started
AUTHOR: Codex
SCOPE: Model viewer lazy chunk payload investigation and split plan
RELATED:
  - planning/refactor/frontend-perf/phases/phase-04-ranking.md
  - planning/refactor/frontend-perf/scorecard-2026-06-24.md
  - frontend/src/features/projects/components/ProjectTabContent.tsx
---

# Phase 04C - Model Payload

## Goal

Reduce the Model tab lazy chunk only after the main app/project route payload has been split and re-measured.

Primary before number:

- `assets/ModelTab-st-s-3xR.js`: 350.06 kB gzip.

Runtime context:

- Model stress: LCP 196 ms, scripted interaction 264 ms, 1 long task, 0 React update commits.

## Breadcrumbs

- `frontend/src/features/projects/components/ProjectTabContent.tsx:11` lazy-loads `ModelTab`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:54` renders the Model tab branch.
- `planning/refactor/frontend-perf/scorecard-2026-06-24.md` records the 350.06 kB gzip lazy chunk.

## Phase Plan

### 1. Inspect the Existing Lazy Chunk

Use the visualizer output to identify whether the chunk is dominated by:

- three.js / rendering vendors
- model parsing utilities
- viewer UI code
- shared project-document/data-table code pulled across a boundary

Exit condition: list the top modules by gzip/parsed size before editing.

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

### 3. Re-Measure Model Route

Compare:

- Model lazy chunk gzip.
- first Model tab LCP.
- scripted interaction time.
- long tasks during route mount.
- whether the 3D scene still renders and remains interactive.

## Verification

- `cd frontend && pnpm run analyze`
- `cd frontend && pnpm run check:sizes`
- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- Browser smoke on `/projects/:projectId/model`.

## Stop Conditions

- Stop if the route split increases Model LCP or creates blank canvas states.
- Stop if the chunk is dominated by irreducible three.js/vendor code and the runtime metrics remain clean.
- Stop if payload changes require viewer behavior changes.
