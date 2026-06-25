---
DATE: 2026-06-24
TIME: 21:13 EDT
STATUS: Complete - route payload splits implemented and measured
AUTHOR: Codex
SCOPE: Route and project-tab payload splitting plan for main bundle reduction
RELATED:
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04-ranking.md
  - planning/archive/dated/2026-06-25/frontend-perf/scorecard-2026-06-24.md
  - frontend/src/app/router.tsx
  - frontend/src/features/projects/components/ProjectTabContent.tsx
  - frontend/src/features/project_status/components/StatusDescription.tsx
---

# Phase 04B - Route Payload Splits

## Goal

Bring the main route chunk below the 250 kB gzip warning threshold or produce a measured reduction large enough to justify the remaining payload.

Primary before number:

- `assets/index-C-de3sCl.js`: 391.28 kB gzip.

Measured result (`scorecard-2026-06-24-phase-04b.md`):

- `assets/index-CobF5RQf.js`: 94.10 kB gzip.
- Top-level route modules now split into async chunks:
  `Dashboard-CvDlYn0l.js`, `MaterialsCatalogPage-D6c2i4it.js`,
  `FrameTypesCatalogPage-HzZWL23i.js`, `GlazingTypesCatalogPage-qqfWVmWs.js`,
  and `ProjectShell-gJilV-Cq.js`.
- Project tabs now split into async chunks for Status, Spaces, Equipment,
  Apertures, Thermal Bridges, Envelope, Climate, and Model.
- Status markdown sanitation is folded into the lazy Status tab chunk
  (`StatusTab-Ckfn9crh.js`, 41.86 kB gzip), isolated from non-status routes
  without adding a nested async markdown request.

## Breadcrumbs

- `frontend/src/app/router.tsx:4` eagerly imports `FrameTypesCatalogPage`.
- `frontend/src/app/router.tsx:5` eagerly imports `GlazingTypesCatalogPage`.
- `frontend/src/app/router.tsx:6` eagerly imports `MaterialsCatalogPage`.
- `frontend/src/app/router.tsx:7` eagerly imports `Dashboard`.
- `frontend/src/app/router.tsx:8` eagerly imports `ProjectShell`.
- `frontend/src/app/router.tsx:17` renders the dashboard route.
- `frontend/src/app/router.tsx:21` renders the materials catalog route.
- `frontend/src/app/router.tsx:27` renders the frame-types catalog route.
- `frontend/src/app/router.tsx:33` renders the glazing-types catalog route.
- `frontend/src/app/router.tsx:41` renders the project-shell route.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:2` eagerly imports `AperturesTab`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:3` eagerly imports `ThermalBridgesPage`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:4` eagerly imports `EquipmentPage`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:5` eagerly imports `EnvelopePage`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:6` eagerly imports `StatusTab`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:7` eagerly imports `SpacesPage`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:11` lazy-loads `ModelTab`.
- `frontend/src/features/projects/components/ProjectTabContent.tsx:17` lazy-loads `ClimateTab`.
- `frontend/src/features/project_status/components/StatusDescription.tsx:2` eagerly imports `react-markdown`.
- `frontend/src/features/project_status/components/StatusDescription.tsx:3` eagerly imports `rehype-sanitize`.

## Phase Plan

### 1. Split Top-Level App Routes

Convert dashboard, catalog pages, and project shell to `React.lazy` route modules with stable `Suspense` fallbacks.

Implementation constraints:

- Keep `/sign-in` small and direct.
- Keep redirect routes synchronous.
- Keep `RequireAuth` behavior unchanged.
- Avoid fallback layout shifts that obscure project or catalog navigation.

Expected win: reduce initial app chunk by removing route page trees from the shared route module.

Result: implemented in `frontend/src/app/router.tsx` with lazy Dashboard,
catalog pages, and ProjectShell. Auth guards and redirect routes remain
synchronous.

### 2. Split Non-Default Project Tabs

`ProjectTabContent` already lazy-loads Climate and Model. Apply the same route-module boundary to Status, Apertures, Spaces, Equipment, Thermal Bridges, and Envelope.

Implementation constraints:

- Keep tab labels and redirects unchanged.
- Use per-tab fallbacks that preserve the existing `tab-panel` class where needed.
- Do not move data fetching out of the current tab components during this phase.

Expected win: project shell should no longer pay for every tab implementation up front.

Result: implemented in
`frontend/src/features/projects/components/ProjectTabContent.tsx` with per-tab
`Suspense` fallbacks preserving `tab-panel` styling.

### 3. Split Status Markdown Renderer

Move `react-markdown` and `rehype-sanitize` behind a small lazy boundary or subcomponent so non-status tabs do not inherit markdown dependencies.

Implementation constraints:

- Preserve the explicit status markdown allow-list.
- Preserve external-link behavior.
- Keep public-view sanitation unchanged.

Expected win: smaller project/status-adjacent chunk and less markdown payload in routes that do not render descriptions.

Result: implemented by moving the sanitized markdown renderer to
`frontend/src/features/project_status/components/StatusMarkdown.tsx`. The
renderer is imported by the already lazy Status tab path, avoiding a nested
route-data-markdown waterfall.

### 4. Re-Measure Before Manual Chunks

Run bundle analysis after route boundaries and compare:

- main chunk gzip
- largest route chunk gzip
- number of async route chunks
- whether `react-markdown`, `rehype-sanitize`, and tab-specific modules moved out of the main route chunk

Only consider `manualChunks` after the route-boundary wins are known.

Result: no manual chunks added. Route boundaries alone moved the main chunk
well below the 250 kB gzip threshold. Remaining oversize chunks are deferred to
Phase 04C/04D where they have narrower owners.

## Verification

- `cd frontend && pnpm run analyze`
- `cd frontend && pnpm run check:sizes`
- `make frontend-dev-check`
- Browser smoke: `/dashboard`, `/catalog/materials`, `/catalog/frame-types`, `/catalog/glazing-types`, `/projects/:projectId/status`, `/projects/:projectId/spaces/space-types`, `/projects/:projectId/equipment`, `/projects/:projectId/model`.

Completed verification:

- `cd frontend && pnpm run analyze` - passed; `bundle-stats.html` emitted.
- `cd frontend && pnpm run check:sizes` - passed.
- `make frontend-dev-check` - passed with existing Fast Refresh warnings only.
- `cd frontend && pnpm exec vitest run src/features/project_status/components/StatusDescription.test.tsx src/App.test.tsx` - 32/32 passed.
- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498` - 11/11 passed after adding Status to the opt-in matrix.

## Stop Conditions

- Stop if lazy boundaries introduce route-level loading loops or auth redirects change.
- Stop if chunk count grows without a meaningful gzip reduction.
- Stop if a route fallback covers persistent navigation in a way that makes tab switching feel broken.
