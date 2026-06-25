---
DATE: 2026-06-24
TIME: 22:08 EDT
STATUS: Phase 04C model payload delta captured
AUTHOR: Codex
SCOPE: Bundle/runtime scorecard for the Model route payload split.
RELATED:
  - planning/archive/dated/2026-06-25/frontend-perf/phases/phase-04c-model-payload.md
  - frontend/src/features/model_viewer/routes/ModelTab.tsx
---

# Phase 04C Scorecard - Model Payload

## Change

- Lazy-load `ModelViewerStage` behind the Model tab shell and preload it only
  once an active model file exists.
- Split route-safe model viewer state helpers into modules that do not import
  `three`: `themeState`, `measureDistance`, and `colorTokens`.
- Keep material/theme render helpers behind the active 3D scene boundary.

## Bundle Delta

| Chunk | Before | After | Delta |
|---|---:|---:|---:|
| Main route JS | 94.12 kB gzip | 94.12 kB gzip | unchanged |
| Model route shell JS | 350.29 kB gzip | 7.00 kB gzip | -343.29 kB |
| Active 3D stage JS | included in Model route shell | 345.06 kB gzip | isolated async stage |

After chunk names from `pnpm run analyze`:

- `assets/ModelTab-COXU4CvF.js`: 20.36 kB raw / 7.00 kB gzip.
- `assets/ModelViewerStage-Bu_u64p4.js`: 1,140.96 kB raw / 345.06 kB gzip.
- `assets/index-BdouGiW5.js`: 298.03 kB raw / 94.12 kB gzip.

## Runtime Row

`make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`
passed 11/11.

| Page | Interaction | LCP | Long tasks | Max long task | React commits | React actual duration |
|---|---:|---:|---:|---:|---:|---:|
| model-viewer | 272 ms | 344 ms | 0 | 0 ms | 0 | 0.0 ms |

## Interpretation

The Model route shell and no-file state no longer pay the 3D payload. Active
model viewing still loads the same coherent scene/rendering stack, but it is
isolated into `ModelViewerStage` and preloaded after active-file selection is
known.
No manual vendor chunk was added because the remaining payload is the real
active-viewer dependency set and the runtime row stayed clean.

## Verification

- `cd frontend && pnpm exec vitest run src/features/model_viewer/__tests__/viewerCore.test.ts src/features/model_viewer/__tests__/viewerThemes.test.ts src/features/model_viewer/__tests__/viewerMeasure.test.ts src/features/model_viewer/__tests__/lensBatch.test.ts src/features/model_viewer/__tests__/legendFilter.test.ts src/App.test.tsx` - 6 files / 68 tests passed.
- `cd frontend && pnpm run analyze` - passed.
- `cd frontend && pnpm run check:sizes` - passed.
- `make frontend-dev-check` - passed with existing fast-refresh warnings only.
- `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498` - passed 11/11.
