---
DATE: 2026-06-24
TIME: 20:57 EDT
STATUS: Active — Phase 2 runtime sweep complete; Phase 3 render sweep is next.
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
seeded stress fixture. Render-commit columns remain intentionally unmeasured
until Phase 3.

Phase 2 harness corrections landed during execution:
- Perf readiness selectors now match current page regions instead of stale
  headings.
- The Model route uses `/projects/:id/model`.
- Recovered server-draft modals are discarded before measurement so table-edit
  scenarios do not poison later rows.
- Metrics JSON files are written under gitignored
  `frontend/test-results/perf-*/<page>-metrics.json`.

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
| 3 — Render sweep (react-scan / Profiler) | `Active` | use `pnpm run dev:scan` / Profiler on the stress table-edit suspects |
| 4 — Triage & fix | `Deferred` | — |

## Next step
Start **Phase 3 — Render sweep**:
1. Ensure backend/frontend are running on `:8000` / `:5173`.
2. Use the seeded stress fixture and codex user:
   `PERF_PROJECT_ID=3d56d037-806d-498b-b559-7f505e0e3498`.
3. Run `cd frontend && pnpm run dev:scan` if the current dev server is not
   already scan-enabled.
4. Capture React render evidence for the highest Layer-B suspects:
   - Spaces Rooms cell edit: 1,973 ms, 5 long tasks, max 244 ms.
   - Equipment Pumps cell edit: 3,117 ms, 4 long tasks, max 261 ms.
   - Catalog hover rows: 2-3 long tasks, max 98-109 ms.
5. Update `scorecard-2026-06-24.md` render-commit columns before ranking
   fixes in Phase 4.

Confirmed flags so far:
- Payload: `assets/index-C-de3sCl.js` is 391.28 kB gzip.
- Payload: `assets/ModelTab-st-s-3xR.js` is 350.06 kB gzip.
- Runtime: stress Spaces Rooms cell edit is 1,973 ms with 5 long tasks.
- Runtime: stress Equipment Pumps cell edit is 3,117 ms with 4 long tasks.

## Open questions (resolve at execution time)
- Lighthouse/DevTools traces were not separately captured in Phase 2; the
  scorecard uses browser PerformanceObserver and Playwright response headers.
  Treat absolute local LCP values as directional.
- Coordinate any Equipment-page (page 6) render fix with the in-flight
  `table-write-architecture-unification` refactor (it rewires the heat-pumps
  frontend client).

## Deferred findings log
- Phase 4 candidate: investigate shared DataTable edit path for stress Spaces
  and Equipment; both show multi-second scripted cell edits and >50 ms long
  tasks.
- Phase 4 candidate: keep Envelope LCP (928 ms local dev) on the ranking list,
  but below table-edit stalls unless Phase 3 shows broad render churn.
