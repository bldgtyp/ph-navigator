---
DATE: 2026-06-29
TIME: 21:20 EDT
STATUS: Active — prerequisite (table-views batch) shipped; ready to start Phase 0
AUTHOR: Claude (Opus 4.8)
SCOPE: Status ledger for the draft-tables batch-seed read refactor.
RELATED:
  - planning/refactor/batch-draft-table-reads/README.md
  - planning/refactor/batch-draft-table-reads/PLAN.md
  - planning/archive/dated/2026-06-29/batch-table-views-endpoint/ (prerequisite — SHIPPED)
---

# Status — Batch-seed draft-tables read

**State:** `Active` — scoped and planned, not started. The prerequisite
`batch-table-views-endpoint` has **shipped** (archived), so this is now
**unblocked** — ready to start Phase 0.

## Current state

- Investigation effectively complete (see README): the 7 per-mount
  `…/draft/tables/<type>` reads each re-load the whole draft server-side; the
  data is co-located and the fan-out is collapsible.
- The load-bearing vs. wasteful split is settled: PR #18's per-table draft-etag
  coordination (cache split + invalidate-others + refetch-before-write) is
  load-bearing and must be preserved; only the initial-mount fan-out is
  collapsed, via batch-seed.
- README + PLAN (phases 0–4) written. No code.

## Next step

Prerequisite met — start Phase 0: lock the endpoint shape (whole-draft vs batch
draft-tables) and **spike the seeding mechanism** (can a pre-mount
`setQueryData` prevent the per-table GET without going stale?) — that is the
riskiest unknown. Mirror the shipped table-views batch's `?keys=`→`?names=`
route convention and its `EquipmentPage.tsx` mount point, but seed the TanStack
Query cache rather than reuse its hand-rolled-hook context read-through.

## Blockers / open decisions

- Endpoint shape (a) whole-draft `GET …/draft/document` vs (b) batch
  `GET …/draft/tables?names=…` — PLAN leans (b) for byte-identical seeding.
- Seeding freshness (`staleTime`/`dataUpdatedAt`) so seeded queries don't
  immediately refetch — must be proven in the Phase 0 spike.

## Hard regression gate

`frontend/tests/e2e/table-regression/table-draft-etag-coordination.spec.ts` must
stay green. If seeding can't preserve the cross-table edit behavior, abandon the
collapse rather than weaken the protocol.

## Verification target

`equipment` draft-tables GETs drop 7 → 1; one whole-draft server load per mount
instead of seven; PR #18 cross-table edit behavior unchanged.
