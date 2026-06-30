---
DATE: 2026-06-29
TIME: 21:35 EDT
STATUS: ✅ DONE (automated gates green; perf re-run + browser smoke are user-gated, see Findings)
AUTHOR: Claude (Opus 4.8)
SCOPE: Prove the request-count win and confirm no view-state behavior regressed.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ./phase-02-frontend-batch-context.md
  - ../../production-frontend-performance/STATUS.md
---

# Phase 03 — Verification

## Goal

Demonstrate the round-trip reduction with evidence and confirm view-state
load/save/reset behave exactly as before on every affected page.

## Steps

1. **Perf re-run (read-only matrix).** Use the parent packet's read-only matrix
   command (see `../../production-frontend-performance/STATUS.md`) and the
   credential handling in the `project_prod_perf_fixture_runbook` memory
   (fixture `PERF_PROJECT_ID = ce77af67-8994-4174-89d6-a59e3bd6189e`, account
   `codex@testing.com`, password via session scratchpad — never in repo/env).
   - Expected: `equipment` route `API#` drops from **19 → ~13** (7 table-views
     collapse to 1; the 7 draft-tables and 5 baseline remain). `spaces` and
     `apertures`/thermal-bridges fall by their own table counts.
   - Capture the new `equipment-metrics.json` request list as evidence; the win
     is **request count**, not bytes (payload was already ~37 KB).

2. **Manual view-state smoke** (equipment, spaces, thermal-bridges, as editor):
   - Column reorder / resize / show-hide persists across reload.
   - First load shows **no default-flash** (load gate preserved).
   - `reset` clears the saved view (DELETE) and rebuilds defaults on next load.
   - A deep-link directly to one table (no batch provider in that path, if any)
     still loads its view via the per-table fallback.

3. **`make ci`** full lane green.

## Acceptance

- New perf metrics show `equipment` at ~13 API calls with a single
  `…/table-views?keys=…` request replacing the 7 per-type calls.
- No view-state behavior change observed in the manual smoke.
- `make ci` green.

## Notes

- This refactor does **not** touch the draft-tables data path or the PR #18
  draft-etag coordination, so the `table-draft-etag-coordination.spec.ts` e2e is
  not a gate here (it should remain green incidentally). The draft-etag gate
  belongs to the separate `batch-draft-table-reads` refactor.

## Findings (2026-06-29)

### Automated gates — GREEN

- **`make ci` backend lane:** ruff format/check, backend-boundaries, `ty`,
  alembic upgrade, and `pytest -n auto` → **1227 passed, 2 skipped** (includes
  the 8 new batch-endpoint tests).
- **`make ci` frontend lane:** `format:check`, `lint` (0 errors), `check:all`
  (tsc + shape/z-index/hex/css-var/data-table guards), `vitest`, and
  production `build` → green. The table_views suite is **24 passing** (10
  existing view-state hook tests unchanged + 5 new read-through tests + 9
  local-state tests).

### Request-count win — proven structurally + by unit test

The 7→1 collapse does not need the production matrix to be *proven correct*:
the read-through test `"a covered key seeds from the batch and issues no
per-table GET"` asserts `fetchTableView` is called **0** times for a batched
key (`fetchTableViews` once for the whole page), and
`"an un-covered key falls back to the per-table GET"` asserts the fallback
still fires exactly once. With all 7 equipment controllers covered by one
provider, their 7 `table-views` GETs become 1 batch GET by construction.

### Perf re-run + browser smoke — USER-GATED (residual)

The empirical production perf re-run and the manual browser smoke require the
production fixture + credentials this session does not hold (see the
`project_prod_perf_fixture_runbook` memory). Hand-off commands for Ed:

1. **Perf matrix** (frontend+backend running against the fixture; password
   handed via the session scratchpad per the runbook, never in repo/env):
   ```
   PERF_PROJECT_ID=ce77af67-8994-4174-89d6-a59e3bd6189e \
   E2E_EMAIL=codex@testing.com E2E_PASSWORD=<run-time pwd> \
   make e2e-perf
   ```
   Expected: `equipment` `API#` drops **19 → ~13** (7 `table-views` → 1; the 7
   draft-tables + 5 baseline remain); capture the new `equipment-metrics.json`
   request list. Spaces/thermal-bridges are single-table so their `table-views`
   count is unchanged (1) — see the Phase 00 plan-doc correction.
2. **Manual smoke** (equipment page, as editor): column reorder/resize/hide
   persists across reload; **no default-flash** on first load; `reset` clears
   the saved view (DELETE) and rebuilds defaults; a deep-link straight to one
   table still loads via the per-table fallback.
