---
DATE: 2026-06-29
TIME: 21:05 EDT
STATUS: In progress — Phase 0–2 done (backend + frontend landed), Phase 3 next
AUTHOR: Claude (Opus 4.8)
SCOPE: Status ledger for the batch table-views read refactor.
RELATED:
  - planning/refactor/batch-table-views-endpoint/README.md
  - planning/refactor/batch-table-views-endpoint/PLAN.md
---

# Status — Batch `table-views` read

**State:** `In progress` — Phases 0 (pre-flight), 1 (backend), and 2 (frontend)
complete on branch `refactor/batch-table-views-endpoint`. Phase 3
(verification) next.

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
- **Phase 2 DONE** — frontend Strategy A landed: `fetchTableViews` +
  `batchContext.ts` (`useProjectTableViewsBatchValue` /
  `ProjectTableViewsBatchProvider` / `useProjectTableViewsBatch`) +
  read-through in `useProjectTableViewState` (seed-or-wait when covered,
  per-table GET fallback otherwise; `prime`/`drop` keep the shared cache
  coherent across saves/resets). Equipment page wired (its 7 reads collapse to
  1). 5 new tests; frontend format/lint/typecheck/build green; the existing
  view-state hook tests pass unchanged. Single-table pages (spaces,
  thermal-bridges) and the smaller multi-table fan-outs (apertures, materials,
  heat-pumps) are intentionally left on the per-table fallback — deferred
  follow-up, each a one-line `ProjectTableViewsBatchProvider` wrap.

## Next step

Phase 3 (verification): re-run the read-only production perf matrix (confirm
`equipment` API# drops ~19 → ~13), manual view-state smoke on the equipment
page (reorder/resize/hide persists, no default-flash, reset clears), and a full
`make ci`.

## Blockers / open decisions

- `keys` param encoding (repeated param vs CSV) — decided in PLAN (lean repeated
  `?keys=…&keys=…`); confirm at implementation.
- Frontend strategy A vs B — PLAN recommends A (prefetch + read-through), keeping
  the per-table fallback. Revisit only if A proves awkward.

## Verification target

`equipment` route API# drops 19 → ~13 on the read-only perf matrix;
`spaces`/`apertures` fall correspondingly; view-state save/reset unchanged.
