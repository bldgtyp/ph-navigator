---
DATE: 2026-06-24
TIME: 20:24 EDT
STATUS: Active — Phase 0 harness implemented; Phase 1 static sweep is next.
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

No scorecard has been produced yet; Phase 1 should read the treemap and create
the first Layer-A flag list.

Decisions taken 2026-06-24 (Ed):
- **Scope = written plan doc only** initially; execution later greenlit via the
  `implement` skill.
- **Dev-only tooling approved**: `rollup-plugin-visualizer` + `react-scan`;
  installed in Phase 0 with pnpm supply-chain protections active.

## Phase ledger
| Phase | State | Note |
|---|---|---|
| 0 — Harness (deps, analyze script, scenarios, stress seed) | `Complete` | `pnpm run analyze`, skipped perf matrix, `PERF-STRESS` seed all verified |
| 1 — Static sweep (bundle treemap) | `Active` | read `frontend/dist/bundle-stats.html`; first payload suspects already visible from build output |
| 2 — Runtime sweep (traces / Lighthouse) | `Deferred` | — |
| 3 — Render sweep (react-scan / Profiler) | `Deferred` | — |
| 4 — Triage & fix | `Deferred` | — |

## Next step
Start **Phase 1 — Static sweep**:
1. Run `cd frontend && pnpm run analyze`.
2. Open `frontend/dist/bundle-stats.html`.
3. Create the first `scorecard-<YYYY-MM-DD>.md` row set for Layer A.
4. Log route/chunk suspects before making any payload fixes.

Known from the verified build output: `index-BCK7l2Eo.js` is ~391 kB gzip and
`ModelTab-s2BTARnm.js` is ~350 kB gzip, both above the starting 250 kB gzip
flag threshold in `PLAN.md` §7.

## Open questions (resolve at execution time)
- Stress-seed mechanism: extend the existing seed, or a dedicated perf fixture?
  (Must not clobber Ed's active session — see dev-seed-owner project memory.)
- Lighthouse runs local (dev/preview build) — agree it's directional, not a
  production metric, before trusting absolute LCP numbers.
- Coordinate any Equipment-page (page 6) render fix with the in-flight
  `table-write-architecture-unification` refactor (it rewires the heat-pumps
  frontend client).

## Deferred findings log
_(empty — populated during Phase 4 with anything that's a real refactor rather
than low-hanging fruit.)_
