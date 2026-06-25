---
DATE: 2026-06-24
TIME: 22:08 EDT
STATUS: Active - Phase 04C implemented and measured.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: State, next step, and the deferred-findings log for the frontend perf eval.
RELATED: ./README.md, ./PLAN.md
---

# STATUS

## Current state
Methodology written (`PLAN.md`). Phase 0 harness is implemented:
- Dev-only tooling installed: `rollup-plugin-visualizer@7.0.1` and
  `react-scan@0.5.7`.
- `frontend` scripts added: `pnpm run analyze` writes
  `frontend/dist/bundle-stats.html`; `pnpm run dev:scan` starts Vite with
  `VITE_REACT_SCAN=true`.
- Vite visualizer is behind `ANALYZE=true`; normal builds are unchanged.
- Perf Playwright matrix scaffolded at
  `frontend/tests/e2e/perf/perf-matrix.spec.ts`, skipped unless `PHN_PERF=1`.
- Stress fixture script added at `backend/scripts/seed_perf_stress_fixture.py`
  with Make wrappers `make seed-perf-stress` and `make e2e-perf`.
- Local default stress fixture seeded:
  `PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`.

First scorecard produced: `scorecard-2026-06-24.md`. Layer A is filled from
`pnpm run analyze`; Layer B is filled from the Playwright perf matrix using the
seeded stress fixture. Layer C is filled from the same perf matrix with the
dev-only root React Profiler enabled by a browser init flag. Phase 4 is now
ranked and planned in `phases/`; Phase 04A has a first cut implemented and
measured in `scorecard-2026-06-24-phase-04a.md`. Phase 04B route payload splits
are implemented and measured in `scorecard-2026-06-24-phase-04b.md`. Phase 04C
Model payload splitting is implemented and measured in
`scorecard-2026-06-24-phase-04c.md`.

Harness corrections landed during Phase 2/3 execution:
- Perf readiness selectors now match current page regions instead of stale
  headings.
- The Model route uses `/projects/:id/model`.
- Recovered server-draft modals are discarded before measurement so table-edit
  scenarios do not poison later rows.
- Metrics JSON files are written under gitignored
  `frontend/test-results/perf-*/<page>-metrics.json`.
- Dev-only React Profiler metrics are captured in those JSON files as
  `reactCommits`.

Decisions taken 2026-06-24 (Ed):
- **Scope = written plan doc only** initially; execution later greenlit via the
  `implement` skill.
- **Dev-only tooling approved**: `rollup-plugin-visualizer` + `react-scan`;
  installed in Phase 0 with pnpm supply-chain protections active.

## Phase ledger
| Phase | State | Note |
|---|---|---|
| 0 — Harness (deps, analyze script, scenarios, stress seed) | `Complete` | `pnpm run analyze`, skipped perf matrix, `PERF-STRESS` seed all verified |
| 1 — Static sweep (bundle treemap) | `Complete` | `scorecard-2026-06-24.md` logs the Layer-A flag list |
| 2 — Runtime sweep (traces / Lighthouse) | `Complete` | `make e2e-perf PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498` passed 10/10; Layer-B rows logged |
| 3 — Render sweep (react-scan / Profiler) | `Complete` | profiler-enabled perf matrix passed 10/10; stress table-edit commits logged |
| 4 — Triage & fix | `In progress` | Phase 04A, 04B, and 04C implemented/measured; continue with Phase 04D secondary runtime |

## Next step

Continue with the next ranked Phase 4 track:
1. `phases/phase-04d-secondary-runtime.md` — P3 trace-first Envelope/catalog runtime follow-up.

Confirmed flags so far:
- Payload: `assets/index-C-de3sCl.js` is 391.28 kB gzip.
- Payload after Phase 04B: `assets/index-CobF5RQf.js` is 94.10 kB gzip;
  top-level/dashboard/catalog/project-tab routes are async chunks. The remaining
  oversize async chunks are `ModelTab-B6gf8QNJ.js` (350.29 kB gzip),
  `ClimateTab-BVw4AAgI.js` (120.96 kB gzip), and
  `types-DaVrxnmF.js` (108.01 kB gzip).
- Payload after Phase 04C: Model route shell is `assets/ModelTab-COXU4CvF.js`
  at 7.00 kB gzip; the active 3D scene stack is isolated in
  `assets/ModelViewerStage-Bu_u64p4.js` at 345.06 kB gzip and preloaded once
  an active model file exists.
- Payload: `assets/ModelTab-st-s-3xR.js` is 350.06 kB gzip.
- Runtime: stress Spaces Rooms cell edit improved from 1,986 ms reproduced to
  1,505 ms after Phase 04A first cut; original scorecard baseline was 2,033 ms.
- Runtime: stress Equipment Pumps cell edit improved from 3,159 ms reproduced to
  1,647 ms after Phase 04A first cut; original scorecard baseline was 3,152 ms.
- Render: stress Spaces Rooms edit improved from 26 commits / 458.8 ms reproduced
  to 23 commits / 421.2 ms; original baseline was 25 commits / 446.1 ms.
- Render: stress Equipment Pumps edit improved from 27 commits / 549.0 ms
  reproduced to 22 commits / 498.9 ms; original baseline was 28 commits /
  565.3 ms.

## Open questions (resolve at execution time)
- Lighthouse/DevTools traces were not separately captured in Phase 2; the
  scorecard uses browser PerformanceObserver and Playwright response headers.
  Treat absolute local LCP values as directional.
- Coordinate any Equipment-page (page 6) render fix with the in-flight
  `table-write-architecture-unification` refactor (it rewires the heat-pumps
  frontend client).
- Remaining Phase 04A render work is still visible: after removing eager sibling
  table refetches, Spaces remains at 23 commits / 421.2 ms and Equipment remains
  at 22 commits / 498.9 ms on the stress edit path.
- Phase 04B reduced the main JS route chunk from 391.28 kB gzip to 94.10 kB
  gzip; remaining route payload work shifts to async chunks, especially Model.
- Phase 04C reduced the Model route shell from 350.29 kB gzip after Phase 04B
  to 7.00 kB gzip; the remaining active-viewer chunk is the coherent 3D stack.

## Deferred findings log
- Phase 04A remaining candidate: investigate active DataTable row/model
  derivation and Equipment controller construction; the first cut removed
  redundant sibling refetches but did not eliminate active-table render churn.
- Phase 04B follow-up resolved during simplify: status markdown sanitation is
  folded into the lazy Status tab chunk (`StatusTab-Ckfn9crh.js`, 41.86 kB
  gzip) to avoid a route-chunk plus API plus markdown-chunk waterfall while
  still keeping markdown out of non-status routes.
- Phase 4 candidate: keep Envelope LCP (928 ms local dev) on the ranking list,
  but below table-edit stalls unless Phase 3 shows broad render churn.
- Phase 4 ranking: `phases/phase-04-ranking.md` promotes shared DataTable edit
  churn to P0, route/project-tab payload splits to P1, Model payload to P2, and
  Envelope/catalog runtime follow-up to P3.
