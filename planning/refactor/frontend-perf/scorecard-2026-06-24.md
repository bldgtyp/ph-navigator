---
DATE: 2026-06-24
TIME: 20:38 EDT
STATUS: Phase 1 static sweep complete — Layer A only.
AUTHOR: Codex
SCOPE: Frontend bundle / payload scorecard from `pnpm run analyze`.
RELATED: ./PLAN.md, ./STATUS.md, frontend/dist/bundle-stats.html
---

# Frontend Perf Scorecard — 2026-06-24

## Run

- Command: `cd frontend && pnpm run analyze`
- Build: Vite 6.4.2 / Rollup 4.60.3
- Treemap: `frontend/dist/bundle-stats.html`
- Scope: **Layer A — Payload only**. Runtime, render, and API columns are not
  measured in this pass.

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

## Route Matrix — Layer A

| Page | Tier | Route chunk (kB gz) | LCP | INP (key interaction) | Long tasks > 50ms | Render commits / interaction | Largest API payload | Flags |
|---|---|---:|---|---|---|---|---|---|
| Dashboard (`/dashboard`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Dashboard currently ships project shell/tab code through eager router imports. |
| Apertures (`/projects/:id/apertures`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Apertures/DataTable/canvas code is in the main chunk. |
| Apertures (`/projects/:id/apertures`) | stress | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Same static payload as realistic; Phase 2 separates runtime/API values. |
| Envelope (`/projects/:id/envelope`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Envelope route is eager in `ProjectTabContent`. |
| Envelope (`/projects/:id/envelope`) | stress | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Same static payload as realistic; Phase 2 separates runtime/API values. |
| Spaces (`/projects/:id/spaces`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Spaces/DataTable code is in the main chunk. |
| Spaces (`/projects/:id/spaces`) | stress | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Same static payload as realistic; Phase 2 separates runtime/API values. |
| Climate (`/projects/:id/climate`) | realistic | 391.28 + 120.83; map adds 44.63 | Not measured | Not measured | Not measured | Not measured | Not measured | Climate route split is working; base app chunk still over budget. |
| Equipment (`/projects/:id/equipment`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Equipment tables and `features/equipment/lib.ts` are in the main chunk. |
| Equipment (`/projects/:id/equipment`) | stress | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Same static payload as realistic; Phase 2 separates runtime/API values. |
| Model Viewer (`/projects/:id/model`) | realistic | 391.28 + 350.06 | Not measured | Not measured | Not measured | Not measured | Not measured | **Model route chunk over budget.** Three/R3F/postprocessing dominate. Base app chunk also over budget. |
| Model Viewer (`/projects/:id/model`) | stress | 391.28 + 350.06 | Not measured | Not measured | Not measured | Not measured | Not measured | **Model route chunk over budget.** Same static payload as realistic; Phase 2 separates runtime/API values. |
| Materials catalog (`/catalog/materials`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Catalog routes ship with project shell/tab code. |
| Materials catalog (`/catalog/materials`) | stress | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Same static payload as realistic; Phase 2 separates runtime/API values. |
| Frame Types catalog (`/catalog/frame-types`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Catalog routes ship with project shell/tab code. |
| Frame Types catalog (`/catalog/frame-types`) | stress | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Same static payload as realistic; Phase 2 separates runtime/API values. |
| Glazing Types catalog (`/catalog/glazing-types`) | realistic | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Catalog routes ship with project shell/tab code. |
| Glazing Types catalog (`/catalog/glazing-types`) | stress | 391.28 | Not measured | Not measured | Not measured | Not measured | Not measured | **Main chunk over budget.** Same static payload as realistic; Phase 2 separates runtime/API values. |

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

## Candidate Fixes To Triage In Phase 4

Do not implement these until Layers B/C are captured and findings are ranked.

| Candidate | Expected impact | Ease | Notes |
|---|---|---|---|
| Lazy-load top-level AppRouter pages (`Dashboard`, catalog pages, `ProjectShell`) | High for first-load/dashboard/catalogs | Easy/medium | Would keep project-document surfaces out of the dashboard/catalog initial route. |
| Lazy-load non-default project tabs in `ProjectTabContent` | High for project routes | Medium | Apertures, Envelope, Spaces, Equipment, Thermal Bridges can follow the existing Model/Climate `React.lazy` pattern. |
| Lazy-load Status markdown renderer | Medium | Easy | Could split `react-markdown`/sanitizer from non-status routes, or make Status tab lazy. |
| Split shared heavy vendors with manual chunks | Medium | Easy/medium | Useful only after route lazy-load boundaries are corrected; otherwise manual chunks may improve caching but not route payload. |
| Review Model Viewer imports/manual chunks | Medium | Medium/hard | Model route is split already; further reduction likely needs three/R3F-specific inspection. |

## Deferred Until Later Phases

- No LCP / INP / long-task / API payload interpretation yet; those are Phase 2.
- No render-commit interpretation yet; that is Phase 3.
- No payload fixes yet; Phase 4 ranks confirmed findings across all layers.
