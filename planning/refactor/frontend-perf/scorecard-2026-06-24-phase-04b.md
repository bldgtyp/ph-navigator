---
DATE: 2026-06-24
TIME: 22:05 EDT
STATUS: Phase 04B route-split delta captured
AUTHOR: Codex
SCOPE: Before/after evidence for route and project-tab payload splits
RELATED:
  - ./STATUS.md
  - ./phases/phase-04b-route-payload-splits.md
  - ./scorecard-2026-06-24.md
---

# Frontend Perf Scorecard - Phase 04B Delta

## Run

- Stress fixture: `PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- Bundle command: `cd frontend && pnpm run analyze`
- Bundle result: passed; `frontend/dist/bundle-stats.html` emitted.
- Size guard: `cd frontend && pnpm run check:sizes` passed.
- Dev frontend gate: `make frontend-dev-check` passed with existing Fast
  Refresh warnings only.
- Focused regression:
  `cd frontend && pnpm exec vitest run src/features/project_status/components/StatusDescription.test.tsx src/App.test.tsx`
- Regression result: 32/32 passed.
- Browser smoke:
  `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
- Browser result: 11/11 passed in 37.5s. The perf matrix now includes the
  Status route.

## Change

Top-level authenticated app routes now lazy-load Dashboard, Materials Catalog,
Frame Types Catalog, Glazing Types Catalog, and ProjectShell. Project tabs now
lazy-load Status, Apertures, Spaces, Equipment, Thermal Bridges, Envelope,
Climate, and Model from the shared tab router. Status markdown sanitation moved
into a separate source module imported by the already lazy Status tab path, so
`react-markdown` and `rehype-sanitize` stay out of non-status routes without a
nested markdown chunk waterfall.

## Bundle Delta

| Asset | Before gzip | After gzip | Delta |
|---|---:|---:|---:|
| Main JS route chunk | 391.28 kB | 94.10 kB | -297.18 kB |
| Main CSS chunk | 30.27 kB | 19.28 kB | -10.99 kB |
| Model async chunk | 350.06 kB | 350.29 kB | +0.23 kB |

Primary after-build chunks:

| Chunk | Gzip |
|---|---:|
| `index-CobF5RQf.js` | 94.10 kB |
| `ProjectShell-_1PHXzNP.js` | 14.00 kB |
| `Dashboard-B44LM5Dz.js` | 3.37 kB |
| `MaterialsCatalogPage-BZwamCMz.js` | 7.01 kB |
| `FrameTypesCatalogPage-ueh9c3sn.js` | 6.46 kB |
| `GlazingTypesCatalogPage-BhKysvFh.js` | 6.10 kB |
| `StatusTab-Ckfn9crh.js` | 41.86 kB |
| `SpacesPage-DXD3Gl-y.js` | 6.81 kB |
| `EquipmentPage-BXI2f72K.js` | 25.64 kB |
| `AperturesTab-DqpTFMpx.js` | 27.80 kB |
| `EnvelopePage-CGiwnXs2.js` | 23.27 kB |
| `ThermalBridgesPage-Dxc3tgQn.js` | 4.36 kB |
| `ClimateTab-ClYLzDVr.js` | 120.96 kB |
| `ModelTab-1RMgBh8o.js` | 350.29 kB |
| `types-C6flCXwr.js` | 108.01 kB |

## Browser Smoke

| Page | Interaction | LCP | Long tasks | React commits |
|---|---:|---:|---:|---:|
| Dashboard | 280 ms | 36 ms | 0 | 0 |
| Status | 279 ms | 36 ms | 0 | 0 |
| Spaces Rooms | 1,460 ms | 348 ms | 4 | 23 |
| Equipment Pumps | 1,573 ms | 52 ms | 4 | 22 |
| Apertures | 280 ms | 36 ms | 1 | 4 |
| Envelope | 292 ms | 732 ms | 0 | 3 |
| Climate | 285 ms | 52 ms | 0 | 0 |
| Model Viewer | 271 ms | 40 ms | 1 | 0 |
| Materials Catalog | 277 ms | 36 ms | 1 | 0 |
| Frame Types Catalog | 284 ms | 64 ms | 2 | 0 |
| Glazing Types Catalog | 286 ms | 52 ms | 1 | 0 |

## Interpretation

Route boundaries alone cleared the Phase 04B goal: the main route chunk is now
well below the 250 kB gzip warning threshold. Manual chunks are not justified
for this phase.

The remaining payload problem is no longer the initial route chunk. It is async
route payload: Model remains the largest chunk, Climate is second, and a shared
`types` chunk is now visible because the tab surfaces moved behind dynamic
imports. Continue with Phase 04C for Model-specific payload before considering
general Rollup `manualChunks`.
