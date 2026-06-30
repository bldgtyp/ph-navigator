---
DATE: 2026-06-29
TIME: 21:55 EDT
STATUS: Not started
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
