---
DATE: 2026-06-29
TIME: 21:35 EDT
STATUS: Not started
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
