---
DATE: 2026-06-29
TIME: 21:20 EDT
STATUS: COMPLETE / ARCHIVED — all phases done + verified; implemented on branch
  `refactor/batch-draft-table-reads`; merge to main (= production deploy) PENDING
  (user-gated)
AUTHOR: Claude (Opus 4.8)
SCOPE: Status ledger for the draft-tables batch-seed read refactor.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ../../../../refactor/production-frontend-performance/scorecards/2026-06-29-phase-06-triage.md (parent Finding 2 — DONE)
  - ../batch-table-views-endpoint/ (prerequisite — SHIPPED)
---

# Status — Batch-seed draft-tables read

**State:** `COMPLETE` — all five phases done and verified, **implemented on
branch `refactor/batch-draft-table-reads`** (not yet merged to `main`). Merging
deploys production, so the merge is **user-gated** behind the production perf
re-run + an explicit deploy decision.

## Current state

- **Phase 0** — design lock + seeding de-risk (shape (b); `staleTime: Infinity`
  + `isSeeding`-gated seed).
- **Phase 1** — backend `GET …/draft/tables?names=…` → `BatchDraftTablesResponse`
  (one whole-draft load; byte-identical per-table entries); 9 tests.
- **Phase 2** — `useDraftTablesBatchSeed` seeds the per-table editor caches on the
  equipment page; the 7 `…/draft/tables/<type>` reads collapse to 1. PR #18
  preserved.
- **Phase 3** — verified: e2e coordination spec 2/2 green (unmodified); live
  capture shows 0 per-table GETs + 1 batch; one whole-draft server load per
  request; `make ci` green.
- **Phase 4** — folded into parent triage Finding 2 (DONE, both halves) + handoff
  CLOSED; packet archived.

## Outcome vs verification target

`equipment` draft-tables GETs **7 → 1** ✓; **one** whole-draft server load per
mount (vs seven) ✓; PR #18 cross-table edit behavior **unchanged** ✓.

## Remaining (user-gated)

- Merge `refactor/batch-draft-table-reads` → `main` (deploys production) — needs
  the user-gated production read-only perf matrix re-run + deploy decision.
- Spaces / thermal-bridges pages still use the per-table fallback (correct, just
  un-optimized); wrap them with the same seed when desired (additive follow-up).

## Hard regression gate (held)

`frontend/tests/e2e/table-regression/table-draft-etag-coordination.spec.ts`
stayed green throughout — unmodified.
