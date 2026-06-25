---
DATE: 2026-06-24
TIME: 21:04 EDT
STATUS: Phase 3 render sweep complete — Layers A+B+C.
AUTHOR: Codex
SCOPE: Frontend payload, runtime, and render scorecard from `pnpm run analyze` plus `make e2e-perf`.
RELATED: ./PLAN.md, ./STATUS.md, frontend/dist/bundle-stats.html
---

# Frontend Perf Scorecard — 2026-06-24

## Run

- Static build command: `cd frontend && pnpm run analyze`
- Build: Vite 6.4.2 / Rollup 4.60.3
- Treemap: `frontend/dist/bundle-stats.html`
- Phase 2 command:
  `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- Phase 2 result: 10/10 Playwright perf matrix rows passed in 40.7s.
- Phase 3 result: 10/10 Playwright perf matrix rows passed in 41.2s with
  dev-only React Profiler capture enabled.
- Perf artifacts: gitignored
  `frontend/test-results/perf-*/<page>-metrics.json` files.
- Scope: **Layers A+B+C**. LCP comes from browser
  `largest-contentful-paint`; long tasks come from `PerformanceObserver`;
  API payloads come from Playwright response headers. Render commits come from a
  dev-only root `React.Profiler` enabled by the perf matrix.
- Caveat: this is local Vite dev-server evidence, not a Lighthouse production
  audit. Treat absolute LCP values as directional.

## Chunk Inventory

Exact chunk sizes come from Vite build output. The visualizer treemap was used
for relative composition only; its per-module gzip estimates are not additive to
the exact emitted chunk gzip.

| Emitted asset | Rendered kB | Gzip kB | Layer-A flag |
|---|---:|---:|---|
| `assets/index-C-de3sCl.js` | 1,387.78 | 391.28 | **Flag: initial/main chunk > 250 kB gzip** |
| `assets/ModelTab-st-s-3xR.js` | 1,158.79 | 350.06 | **Flag: lazy route chunk > 250 kB gzip** |
| `assets/ClimateTab-DZD7oFns.js` | 408.12 | 120.83 | ok |
| `assets/climateLeafletMap-CS85z2n_.js` | 152.46 | 44.63 | ok; Leaflet is split from base Climate tab |
| `assets/with-selector-C2gtcC-5.js` | 2.35 | 1.03 | ok |
| `assets/index-BdKsLZax.css` | 199.57 | 30.27 | watch; not in the JS threshold |
| `assets/ClimateTab-Dztau3qC.css` | 22.81 | 4.23 | ok |
| `assets/climateLeafletMap-CIGW-MKW.css` | 15.61 | 6.46 | ok |
| `assets/ModelTab-BGNsE96K.css` | 14.71 | 2.87 | ok |

## Route Matrix — Layers A+B+C

| Page | Tier | Route chunk (kB gz) | LCP | INP (key interaction) | Long tasks > 50ms | Render commits / interaction | Largest API payload | Flags |
|---|---|---:|---|---|---|---|---|---|
| Dashboard (`/dashboard`) | realistic | 391.28 | 188 ms | script 277 ms | 0 | 0 commits | 0.4 kB `/api/v1/projects` | **Main chunk over budget.** Runtime clean in local harness. |
| Apertures (`/projects/:id/apertures`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Realistic fixture not run in Phase 2. |
| Apertures (`/projects/:id/apertures`) | stress | 391.28 | 208 ms | script 275 ms | 1; max 51 ms | 4 commits; 6.4 ms total; max 2.0 ms | 6.4 kB `/api/v1/catalogs/frame-types` | **Main chunk over budget.** Runtime/render mostly clean; one threshold long task. |
| Envelope (`/projects/:id/envelope`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Realistic fixture not run in Phase 2. |
| Envelope (`/projects/:id/envelope`) | stress | 391.28 | 928 ms | script 289 ms | 0 | 3 commits; 15.1 ms total; max 5.2 ms | 1.2 kB `/envelope?source=draft` | **Main chunk over budget.** Highest observed local LCP; interaction render clean. |
| Spaces (`/projects/:id/spaces`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Realistic fixture not run in Phase 2. |
| Spaces (`/projects/:id/spaces`) | stress | 391.28 | 184 ms | script 2,033 ms | 5; max 208 ms | **25 commits; 446.1 ms total; max 62.8 ms** | 25.6 kB `/draft/tables/rooms` | **Main chunk over budget. Interaction over 1s with render churn and long tasks.** |
| Climate (`/projects/:id/climate`) | realistic | 391.28 + 120.83; map adds 44.63 | 176 ms | script 281 ms | 0 | 0 commits | 0.4 kB `/api/v1/projects/:id` | Climate split works; runtime/render clean in local harness. Base app chunk still over budget. |
| Equipment (`/projects/:id/equipment`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Realistic fixture not run in Phase 2. |
| Equipment (`/projects/:id/equipment`) | stress | 391.28 | 192 ms | script 3,152 ms | 5; max 263 ms | **28 commits; 565.3 ms total; max 88.5 ms** | 5.5 kB `/draft/tables/appliances` | **Main chunk over budget. Interaction over 3s with render churn and long tasks.** |
| Model Viewer (`/projects/:id/model`) | realistic | 391.28 + 350.06 | Not measured | Not measured | Not measured | Not measured | Not measured | **Model route chunk over budget.** Realistic fixture not run in Phase 2. |
| Model Viewer (`/projects/:id/model`) | stress | 391.28 + 350.06 | 196 ms | script 264 ms | 1; max 75 ms | 0 commits | 0.4 kB `/api/v1/projects` | **Model route chunk over budget.** Runtime/render clean in local harness. |
| Materials catalog (`/catalog/materials`) | realistic | 391.28 | 172 ms | script 274 ms | 2; max 97 ms | 0 commits | 10.9 kB `/api/v1/catalogs/materials?include_inactive=true` | **Main chunk over budget.** Catalog long tasks are not React commits in this scenario. |
| Materials catalog (`/catalog/materials`) | stress | 391.28 | 172 ms | script 274 ms | 2; max 97 ms | 0 commits | 10.9 kB `/api/v1/catalogs/materials?include_inactive=true` | Same catalog dataset; not project-tiered in current matrix. |
| Frame Types catalog (`/catalog/frame-types`) | realistic | 391.28 | 172 ms | script 274 ms | 3; max 112 ms | 0 commits | 6.4 kB `/api/v1/catalogs/frame-types?include_inactive=true` | **Main chunk over budget.** Catalog long tasks are not React commits in this scenario. |
| Frame Types catalog (`/catalog/frame-types`) | stress | 391.28 | 172 ms | script 274 ms | 3; max 112 ms | 0 commits | 6.4 kB `/api/v1/catalogs/frame-types?include_inactive=true` | Same catalog dataset; not project-tiered in current matrix. |
| Glazing Types catalog (`/catalog/glazing-types`) | realistic | 391.28 | 184 ms | script 281 ms | 2; max 101 ms | 0 commits | 2.0 kB `/api/v1/catalogs/glazing-types?include_inactive=true` | **Main chunk over budget.** Catalog long tasks are not React commits in this scenario. |
| Glazing Types catalog (`/catalog/glazing-types`) | stress | 391.28 | 184 ms | script 281 ms | 2; max 101 ms | 0 commits | 2.0 kB `/api/v1/catalogs/glazing-types?include_inactive=true` | Same catalog dataset; not project-tiered in current matrix. |

## Confirmed Layer-A Findings

1. **Main route chunk is the broadest payload problem.**
   - Evidence: `assets/index-C-de3sCl.js` is 391.28 kB gzip, above the 250 kB
     starting threshold.
   - Router evidence: `frontend/src/app/router.tsx` eagerly imports Dashboard,
     all catalog pages, and ProjectShell. ProjectShell eagerly imports
     `ProjectTabContent`, which eagerly imports Apertures, Spaces, Equipment,
     Thermal Bridges, Envelope, and Status.
   - Visualizer composition: main chunk includes React/ReactDOM, React Router,
     TanStack Query/Table/Virtual, Radix/Floating UI, DnD Kit, Lucide icons,
     DataTable code, Apertures, Envelope, Equipment, catalog import dialogs, and
     project status markdown parsing.

2. **Only Model Viewer, Climate, and the nested Leaflet map are split today.**
   - Evidence: separate emitted chunks exist for `ModelTab`, `ClimateTab`, and
     `climateLeafletMap`.
   - No separate chunks exist for Dashboard, catalogs, Apertures, Envelope,
     Spaces, Equipment, Thermal Bridges, or Status.

3. **Model Viewer lazy chunk is independently over budget.**
   - Evidence: `assets/ModelTab-st-s-3xR.js` is 350.06 kB gzip.
   - Visualizer composition: dominated by `three`, `@react-three/fiber`,
     `postprocessing`, `@react-three/drei`, and `three-stdlib`.
   - Interpretation: acceptable to be model-route-only, but still a payload
     target if Phase 4 needs a high-impact static fix.

4. **Climate split is effective enough for the starting budget.**
   - Evidence: `ClimateTab` is 120.83 kB gzip; `climateLeafletMap` is 44.63 kB
     gzip and loads separately.
   - Visualizer composition: Climate is dominated by Recharts/D3; no action
     flagged in Phase 1.

5. **Status markdown parsing rides in the main chunk.**
   - Evidence: treemap shows `react-markdown`, `rehype-sanitize`, `unified`,
     `micromark`, and related `mdast`/`hast` packages in `index-C-de3sCl.js`.
   - Source: `StatusDescription.tsx` imports `react-markdown`; Status is eager
     through `ProjectTabContent`.

## Confirmed Layer-B Findings

1. **Stress table edits are the clearest runtime problem.**
   - Spaces Rooms cell edit: 2,033 ms scripted interaction, 5 long tasks, max
     208 ms, largest API response 25.6 kB from `/draft/tables/rooms`.
   - Equipment Pumps cell edit: 3,152 ms scripted interaction, 5 long tasks, max
     263 ms, largest API response 5.5 kB from `/draft/tables/appliances`.
   - Interpretation: Layer C confirms render churn is part of the stall; Phase
     4 should separate render work from grid edit pipeline work and
     mutation/refetch behavior.

2. **Envelope has the highest observed local LCP.**
   - Stress Envelope route: 928 ms LCP with no >50 ms long tasks.
   - Interpretation: likely initial paint/content sequencing rather than a long
     main-thread stall, but this needs trace confirmation before ranking.

3. **Catalog pages show small but repeatable long-task clusters.**
   - Materials: 2 long tasks, max 97 ms.
   - Frame Types: 3 long tasks, max 112 ms.
   - Glazing Types: 2 long tasks, max 101 ms.
   - Interpretation: visible enough to track, lower priority than stress table
     edits because Layer C did not show React commits during catalog hover.

4. **Model Viewer runtime was clean despite its large payload.**
   - Stress Model route: 196 ms LCP, 264 ms scripted drag, 1 long task at 75 ms,
     0 React commits.
   - Interpretation: current priority remains payload size, not render churn.

## Confirmed Layer-C Findings

1. **Stress table edits are confirmed render-churn problems.**
   - Spaces Rooms edit: 25 React update commits, 446.1 ms total actual render
     duration, max commit 62.8 ms.
   - Equipment Pumps edit: 28 React update commits, 565.3 ms total actual
     render duration, max commit 88.5 ms.
   - Interpretation: Phase 4 should start at the shared DataTable edit path,
     slice controller updates, row-model derivation, and mutation/refetch
     invalidation boundaries before page-specific fixes.

2. **Catalog hover long tasks are not React commit churn.**
   - Materials, Frame Types, and Glazing Types catalog hover scenarios recorded
     0 React commits despite 2-3 >50 ms long tasks.
   - Interpretation: do not prioritize React memoization for the catalog hover
     row based on this evidence; inspect pointer/hover CSS, grid DOM work, or
     browser-level work only if it remains a ranked Phase 4 target.

3. **Envelope and Apertures interactions have low render cost.**
   - Envelope drag: 3 commits, 15.1 ms total actual render duration.
   - Apertures drag: 4 commits, 6.4 ms total actual render duration.
   - Interpretation: their current runtime flags are lower priority than
     stress table edits.

## Candidate Fixes Triaged In Phase 4

Ranking and phased implementation plans now live in
`phases/phase-04-ranking.md`. Do not implement these until a Phase 4 track is
explicitly selected.

| Candidate | Expected impact | Ease | Notes |
|---|---|---|---|
| Investigate shared DataTable edit pipeline (`useGridEdit`, write reducer, row-model derivation, slice invalidation) | High for stress Spaces/Equipment | Medium/hard | Confirmed by Layer B+C: 25-28 commits and 446-565 ms render work per edit. |
| Lazy-load top-level AppRouter pages (`Dashboard`, catalog pages, `ProjectShell`) | High for first-load/dashboard/catalogs | Easy/medium | Would keep project-document surfaces out of the dashboard/catalog initial route. |
| Lazy-load non-default project tabs in `ProjectTabContent` | High for project routes | Medium | Apertures, Envelope, Spaces, Equipment, Thermal Bridges can follow the existing Model/Climate `React.lazy` pattern. |
| Lazy-load Status markdown renderer | Medium | Easy | Could split `react-markdown`/sanitizer from non-status routes, or make Status tab lazy. |
| Split shared heavy vendors with manual chunks | Medium | Easy/medium | Useful only after route lazy-load boundaries are corrected; otherwise manual chunks may improve caching but not route payload. |
| Review Model Viewer imports/manual chunks | Medium | Medium/hard | Model route is split already; further reduction likely needs three/R3F-specific inspection. |

## Deferred Until Later Phases

- No payload fixes yet; Phase 4 ranked confirmed findings across all layers in
  `phases/phase-04-ranking.md`.
