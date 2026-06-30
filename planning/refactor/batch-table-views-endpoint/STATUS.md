---
DATE: 2026-06-29
TIME: 21:05 EDT
STATUS: In progress — Phase 0+1 done (backend landed), Phase 2 next
AUTHOR: Claude (Opus 4.8)
SCOPE: Status ledger for the batch table-views read refactor.
RELATED:
  - planning/refactor/batch-table-views-endpoint/README.md
  - planning/refactor/batch-table-views-endpoint/PLAN.md
---

# Status — Batch `table-views` read

**State:** `In progress` — Phase 0 (pre-flight) and Phase 1 (backend) complete
on branch `refactor/batch-table-views-endpoint`. Phase 2 (frontend) next.

## Current state

- Problem verified against production perf data and backend code: the
  `table-views` per-table fan-out (7 GETs on `equipment`) is a pure round-trip
  artifact, batchable with no data-model change.
- README (rationale + verified facts) and PLAN (phases 0–4) are written.
- **Phase 0 DONE** — findings recorded in `phases/phase-00-preflight.md`:
  repo query shape, response envelope, editor-only access, and per-page key
  sets confirmed. Correction logged: `spaces`/`thermal-bridges` are
  single-table (no fan-out); equipment's 7→1 is the verified win.
- **Phase 1 DONE** — backend batch read endpoint landed:
  `GET /api/v1/projects/{id}/table-views?keys=…` →
  `BatchTableViewsResponse { views }`, backed by `repository.get_many`
  (`table_key = ANY`) and `service.get_table_views`. 8 new tests; backend
  lint/boundaries/`ty`/pytest green for the module.

## Next step

Phase 2 (frontend): add `fetchTableViews` + a page-scoped batch context and a
read-through in `useProjectTableViewState`, then wire the equipment page so its
7 view-state reads collapse to 1. Per-table fallback stays for un-wrapped pages.

## Blockers / open decisions

- `keys` param encoding (repeated param vs CSV) — decided in PLAN (lean repeated
  `?keys=…&keys=…`); confirm at implementation.
- Frontend strategy A vs B — PLAN recommends A (prefetch + read-through), keeping
  the per-table fallback. Revisit only if A proves awkward.

## Verification target

`equipment` route API# drops 19 → ~13 on the read-only perf matrix;
`spaces`/`apertures` fall correspondingly; view-state save/reset unchanged.
