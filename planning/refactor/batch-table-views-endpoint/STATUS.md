---
DATE: 2026-06-29
TIME: 21:05 EDT
STATUS: Active
AUTHOR: Claude (Opus 4.8)
SCOPE: Status ledger for the batch table-views read refactor.
RELATED:
  - planning/refactor/batch-table-views-endpoint/README.md
  - planning/refactor/batch-table-views-endpoint/PLAN.md
---

# Status — Batch `table-views` read

**State:** `Active` — scoped and planned, not started. Ready to hand off.

## Current state

- Problem verified against production perf data and backend code: the
  `table-views` per-table fan-out (7 GETs on `equipment`) is a pure round-trip
  artifact, batchable with no data-model change.
- README (rationale + verified facts) and PLAN (phases 0–4) are written.
- No code written yet.

## Next step

Phase 0 pre-flight: confirm the `repository.get` query shape and enumerate the
per-page `table_key` sets, then start Phase 1 (backend batch endpoint).

## Blockers / open decisions

- `keys` param encoding (repeated param vs CSV) — decided in PLAN (lean repeated
  `?keys=…&keys=…`); confirm at implementation.
- Frontend strategy A vs B — PLAN recommends A (prefetch + read-through), keeping
  the per-table fallback. Revisit only if A proves awkward.

## Verification target

`equipment` route API# drops 19 → ~13 on the read-only perf matrix;
`spaces`/`apertures` fall correspondingly; view-state save/reset unchanged.
