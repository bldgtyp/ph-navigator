---
DATE: 2026-06-29
TIME: 21:05 EDT
STATUS: Active — phased plan, not started.
AUTHOR: Claude (Opus 4.8)
SCOPE: Phased implementation plan for the batch table-views read endpoint and
  its frontend consumer rewiring.
RELATED:
  - planning/refactor/batch-table-views-endpoint/README.md
  - planning/refactor/production-frontend-performance/scorecards/2026-06-29-phase-06-triage.md
---

# Implementation Plan — Batch `table-views` read

Read `README.md` first for the why, the verified facts, and out-of-scope notes.
This file is the execution **overview**; the detailed, implementation-ready steps
live in `phases/`:

- `phases/phase-00-preflight.md` — confirmations + decisions (no code)
- `phases/phase-01-backend-batch-endpoint.md` — model / repo / service / route + tests
- `phases/phase-02-frontend-batch-context.md` — batch context + per-table read-through
- `phases/phase-03-verification.md` — perf re-run + view-state smoke + `make ci`
- `phases/phase-04-closeout.md` — closeout gate + fold-back

Each phase is independently shippable up to its verification gate; do not start a
phase before the prior one's gate is green. The sections below summarize each.

## Key facts the plan relies on (verified 2026-06-29)

- `table-views` is a per-(user, project, table_key) JSON `view_state` row.
  Backend: `backend/features/table_views/{routes,service,repository}.py`.
  Single-key read is `GET …/projects/{pid}/table-views/{table_key}` →
  `TableViewResponse { view_state_schema_version, view_state, updated_at }`.
- The read is **editor-only** (`ProjectEditAccess` → `require_editor_user`);
  anonymous/viewer pages use `useLocalTableViewState` (no network). So the batch
  endpoint inherits editor-only access and has **no viewer code path**.
- Frontend consumer `useProjectTableViewState`
  (`frontend/src/features/table_views/hooks.ts`) is **not** TanStack Query — it
  is a hand-rolled `useEffect` + `fetchTableView` per mounted table component,
  with a debounced PUT save and a local `isLoading` gate. This is the single
  biggest reason the frontend half is more than a query swap; Phase 2 addresses
  it explicitly.
- That hook is **not** called by pages directly — it is invoked **inside
  `useSliceTableController`** (`frontend/src/shared/ui/data-table/feature/`),
  once per table, with `enabled: isEditor && viewStateEnabled`. So there are
  many call sites and the controller does not currently thread a "preloaded
  view" prop. Injecting via props would touch every controller caller; a
  **React context** the page populates and the hook reads is far less invasive
  (see Phase 2). Disabled tables (`enabled: false`) don't load view state — the
  batch should request only enabled keys (decided in Phase 0).
- A missing row returns a default-empty `TableViewResponse` (`_row_to_response`
  with `row is None`), so "no saved view" is a value, not a 404. The batch must
  preserve this per-key.

## Phase 0 — Pre-flight (no code; ~0.5 h)

Confirm before writing anything:

1. `backend/features/table_views/repository.py` `get(conn, user_id, project_id,
   table_key)` query shape — so the batch query is a faithful `table_key =
   ANY(%s)` widening of it (same `WHERE user_id AND project_id`, same selected
   columns, same ordering rules).
2. The full set of `table_key`s each page requests, to size the batch and write
   the test fixture: equipment = `pumps, fans, ventilators, hot_water_heaters,
   hot_water_tanks, electric_heaters, appliances`; also enumerate the keys
   `spaces` and `apertures` pages request (grep their `useProjectTableViewState`
   call sites).
3. Whether any caller passes `enabled: false` per table (the hook gates on it) —
   the batch must only request keys for *enabled* tables, or request all and let
   consumers ignore disabled ones. Decide which in Phase 2.

Gate: a one-paragraph note in this file's "Phase 0 findings" appended below,
listing the repository query and the per-page key sets.

## Phase 1 — Backend batch endpoint (~0.5 day incl. tests)

All changes under `backend/features/table_views/`. `uv` only; raw parameterized
SQL; strict typing (`ty`); Pydantic v2.

1. **Model** (`types`/`models` file alongside `TableViewResponse`): add
   ```
   class BatchTableViewsResponse(BaseModel):
       model_config = ConfigDict(extra="forbid")
       views: dict[str, TableViewResponse]   # table_key -> config (defaults for absent)
   ```
2. **Repository:** add `get_many(conn, user_id, project_id, table_keys: list[str])
   -> list[dict]` — one `SELECT … WHERE user_id = %s AND project_id = %s AND
   table_key = ANY(%s)`. Reuse the exact column list from `get`. Do **not** loop
   `get` per key (that defeats the purpose).
3. **Service:** add `get_table_views(table_keys, access) -> BatchTableViewsResponse`:
   - `require_editor_user(access)`.
   - `validate_table_key` for each requested key (reuse existing regex helper);
     reject the whole request `400 invalid_table_key` on any bad key (consistent
     with the single-key route).
   - one `repository.get_many(...)` call; index rows by `table_key`.
   - build `views[key] = _row_to_response(row_or_None)` for **every requested
     key**, so absent keys get the same default-empty response the single-key
     route returns. This keeps per-key semantics identical.
4. **Route** (`routes.py`): add
   `GET /api/v1/projects/{project_id}/table-views` with a required repeated/CSV
   `keys` query param → `BatchTableViewsResponse`. Keep it a sibling of the
   existing `/{table_key}` routes; **do not** remove or change the single-key
   GET/PUT/DELETE (writes and direct reads still use it). Mind FastAPI route
   ordering so `/table-views` (collection) is not shadowed by
   `/table-views/{table_key}`.
   - Decide `keys` encoding: `?keys=pumps&keys=fans` (FastAPI `list[str]`) is
     cleaner than CSV and avoids comma-in-key ambiguity. Bound the list length
     (e.g. ≤ 64) to avoid an unbounded `ANY`.

**Tests** (`backend` pytest, mirror existing table_views tests):
- batch returns one entry per requested key; present keys carry stored
  `view_state`; absent keys carry the default-empty response.
- malformed key → `400 invalid_table_key`, nothing partially returned.
- non-editor access → same rejection as single-key route.
- a key the user has *not* saved coexists in the same response with keys they
  have saved (mixed present/absent).

Gate: `make ci` backend lane green; new tests cover the four cases above.

## Phase 2 — Frontend: fetch once, fan-in (~0.5–1 day incl. smoke)

The hand-rolled hook is the crux. Two viable strategies — **recommendation: A.**

**Strategy A — page-scoped batch context + per-table read-through (recommended).**
- Add `fetchTableViews(projectId, keys, signal)` to
  `frontend/src/features/table_views/api.ts` hitting the batch route.
- Introduce a small **React context provider** (e.g.
  `ProjectTableViewsBatchProvider` / `useProjectTableViewsBatch`) the
  equipment/spaces/apertures page mounts once with its enabled key set; it
  fetches the batch and exposes a `Map<tableKey, TableViewResponse>` plus a
  `ready` flag. **Context, not props** — because `useProjectTableViewState` is
  reached through `useSliceTableController` at many call sites, a prop would have
  to be threaded through every one of them; a context the hook reads needs zero
  call-site changes.
- Teach `useProjectTableViewState` to consult that context first: when the batch
  is `ready` and has the key, seed `view` from it and skip the per-table GET;
  when the context is absent (no provider mounted) or the key is missing
  (deep-link, disabled-then-enabled), fall back to today's `fetchTableView` path
  unchanged. This preserves the load-gate UX (no default-flash) and the
  debounced-save path verbatim — only the *initial read* source changes.
- Saves/deletes stay per-table (unchanged). After a save, refresh or drop the
  batch context entry for that key so a remount reads fresh; the hook already
  owns the live `view` state, so this is a correctness-on-remount detail, not a
  hot-path one.

**Strategy B — migrate `useProjectTableViewState` to TanStack Query first**,
then seed per-key caches from one batch query via `setQueryData` (mirrors the
data-slice pattern in `table-slice.ts`). Cleaner long-term and standards-aligned,
but it rewrites a debounced, abort-aware, scope-guarded hook with subtle UX
(no default-flash) — higher regression risk. Defer unless Strategy A proves
awkward.

Either way: **the per-table fallback must remain** so a table rendered outside a
batched page still loads its view. `pnpm` only; run `pnpm run format`.

**Tests:** extend `__tests__/useProjectTableViewState.test.ts` (and add a batch
hook test) — batched key seeds without a GET; un-batched key still GETs; save
path unchanged.

Gate: `make frontend-dev-check` green; the three pages render and the view-state
save still round-trips.

## Phase 3 — Verification

1. Re-run the read-only production perf matrix (parent packet `STATUS.md` for the
   command; `project_prod_perf_fixture_runbook` memory for credentials). Confirm
   `equipment` API# drops from 19 → ~13, and `spaces`/`apertures` fall by their
   table counts. Payload is already ~37 KB; the win is round-trip count.
2. Manual smoke (the three pages): column reorder/resize/visibility persists;
   reload restores it; `reset` (DELETE) still clears; no default-flash on load.
3. `make ci` full lane green.

## Phase 4 — Closeout

1. `simplify` skill on the diff, then `docs-pass` skill on the diff.
2. `make format`; if it changes files, re-inspect and re-run `make ci`.
3. Update this folder's `STATUS.md` to `Implemented on branch` / `Merged to main`
   with evidence (perf re-run numbers). Fold the result into the parent packet's
   triage card Finding 2.

## Risk / rollback

- Backend is purely additive (new route + model + repo fn); revert is deleting
  them. The single-key route is untouched, so nothing depends on the batch to
  function.
- Frontend Strategy A keeps the per-table fallback, so a half-wired page still
  works (it just keeps fanning out). That makes Phase 2 safe to land
  page-by-page (equipment first, then spaces/apertures).

## Phase 0 findings

_(append here when Phase 0 runs)_
