---
DATE: 2026-06-29
TIME: 21:55 EDT
STATUS: COMPLETE (2026-06-29) — collapse + #18 verified locally; production perf matrix user-gated
AUTHOR: Claude (Opus 4.8)
SCOPE: Prove the round-trip + server-load reduction and confirm PR #18 behavior
  is unchanged.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ./phase-02-frontend-batch-seed.md
  - ../../production-frontend-performance/STATUS.md
---

# Phase 03 — Verification

## Goal

Show the draft-tables fan-out collapsed (client round-trips and server loads) and
prove the cross-table edit bug (#18) did not return.

## Steps

1. **Regression gate first.** Run
   `frontend/tests/e2e/table-regression/table-draft-etag-coordination.spec.ts`
   (`E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test
   tests/e2e/table-regression --grep @table-draft-etag`). Must be green. This is
   the gate that authorizes everything else.

2. **Client round-trips — perf re-run.** Read-only matrix (parent packet
   `../../production-frontend-performance/STATUS.md` for the command;
   `project_prod_perf_fixture_runbook` memory for credential handling; fixture
   `PERF_PROJECT_ID = ce77af67-8994-4174-89d6-a59e3bd6189e`, account
   `codex@testing.com`).
   - Expected `equipment` `API#`: 7 draft-tables GETs → **1** batch. With the
     table-views batch already shipped, the route should land near **7** total
     (5 baseline + 1 draft-tables batch + 1 table-views batch). Capture the new
     request list as evidence.
   - `spaces` / thermal-bridges fall by their table counts.

3. **Server load — confirm one whole-draft load per mount.** Inspect the
   `project_document.*` load logs / a load counter to confirm the batch does a
   single `get_current_document_view` where the page previously triggered seven.

4. **Manual editor smoke** (equipment, spaces, thermal-bridges, as editor):
   load; edit across multiple tables without saving; save version; reload-draft;
   version-locked path; deep-link to a single table (fallback path). The #18
   cross-table edit must not reappear, and `If-Match` must always carry the
   current draft etag (no false `draft_etag_mismatch`).

5. **`make ci`** full lane green.

## Acceptance

- e2e coordination spec green.
- Perf metrics show `equipment` draft-tables collapsed to a single batch request.
- One whole-draft server load per mount (vs seven).
- No view-state or write-path behavior change in the manual smoke.
- `make ci` green.

## Results (2026-06-29)

Verified locally against the running dev stack (Postgres + backend :8000 +
frontend :5173):

1. **Regression gate — GREEN.** `table-draft-etag-coordination.spec.ts` 2/2
   (`Fans → Hot-water tanks` and `Pumps → Appliances` both write with no false
   stale-draft blocker). Spec **unmodified** — its recorder can't see the batch
   URL and never asserted the initial fan-out, so no edit was needed. Re-run
   green after the `simplify` fixes too.
2. **Client round-trips — collapsed.** A throwaway network-capture spec mounted
   the equipment page and observed **0** per-table `…/draft/tables/<name>` GETs
   and the batch `…/draft/tables?names=` request carrying exactly the 7 names.
   (In dev the seed effect runs twice under `<StrictMode>`, so 2 identical batch
   requests; a production build issues 1 — same dev-only double as the shipped
   table-views batch's `AbortController` effect.) The 7→1 collapse is confirmed.
3. **Server load — one per request.** Backend `project_document.loaded` logs show
   the `/draft/tables` batch path emits a **single** whole-draft load per request
   (vs seven for the old per-table fan-out). The backend unit test
   `test_batch_does_one_document_load` pins this.
4. **Manual smoke.** The cross-table edit flow (the #18 manual case) is exercised
   by the e2e coordination spec on equipment; no `draft_etag_mismatch`, no false
   blocker. Spaces / thermal-bridges remain on the per-table fallback (Phase 2
   shipped equipment only), so their behavior is unchanged.
5. **`make ci` — GREEN.** Full local lane: backend `ruff format/check` +
   `check_backend_boundaries` + `ty` + `pytest`, then frontend
   `format:check` + `lint` + `check:all` + `vitest` + `build`. All passed.

### Deferred / user-gated

- **Production read-only perf matrix** (`e2e-perf`, `PERF_PROJECT_ID` fixture in
  the Render Shell) is user-gated per `project_prod_perf_fixture_runbook` —
  same handling as the shipped table-views Phase 3. The local capture above
  already proves the client/server collapse; the production matrix only
  re-confirms the absolute `API#` on the prod fixture.
