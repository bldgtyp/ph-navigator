---
DATE: 2026-06-29
TIME: 21:35 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8)
SCOPE: Pre-flight confirmations and decisions that gate the implementation
  phases. No code.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ../STATUS.md
---

# Phase 00 — Pre-flight

## Goal

Lock the two facts and two decisions the later phases depend on, so Phase 01/02
are mechanical. No code; output is the "Findings" section at the bottom of this
file filled in.

## Confirm

1. **Repository query shape** — `backend/features/table_views/repository.py::get`
   selects `user_id, project_id, table_key, view_state_schema_version,
   view_state, view_state_size_bytes, updated_at` from `user_table_views`
   filtered by `(user_id, project_id, table_key)`. The batch `get_many` must be a
   faithful widening: identical column list, same `(user_id, project_id)` filter,
   `table_key = ANY(...)`. (Confirmed at authoring time; re-verify it has not
   changed.)
2. **Response envelope** — the single-key response is `TableViewResponse
   { view_state_schema_version, view_state, updated_at }`, and `view_state` is the
   nested `ViewStateEnvelope { schema_fingerprint, view_state }` on the frontend
   (`frontend/src/features/table_views/types.ts`). The batch response must carry
   exactly this per key so seeding is a 1:1 map, including the **default-empty**
   shape (`view_state: null`) for keys with no row (`_row_to_response(None)`).
3. **Access** — single-key routes use `require_project_edit_access`
   (`ProjectEditAccess`). Batch is editor-only too; viewers use
   `useLocalTableViewState` (no network), so there is no viewer path to cover.
4. **Key charset** — `validate_table_key` enforces `^[a-z][a-z0-9_]*$`. The batch
   validates each requested key with the same helper.

## Decide

5. **`keys` param encoding** — default to a repeated query param
   (`?keys=pumps&keys=fans`, FastAPI `list[str]`) over CSV: no comma-in-key
   ambiguity, native FastAPI parsing. Bound the list (e.g. `1..64`) so `ANY` is
   never unbounded. Record the chosen bound.
6. **Per-page key sets** — enumerate the `tableKey`s each page mounts on initial
   render, because that is the batch's request list:
   - **equipment** — the `*_TABLE_NAME` constants in
     `frontend/src/features/equipment/types.ts` (`pumps`, `fans`, `ventilators`,
     `hot_water_heaters`, `hot_water_tanks`, `electric_heaters`, `appliances`)
     plus any heat-pump sub-tables / rooms that mount on load. **Confirm whether
     all slots mount on initial render or only the active sub-tab** — the
     2026-06-29 perf run fetched all 7 table-views on one load, implying all
     mount; verify so the batch key list is exact.
   - **spaces** — keys from `frontend/src/features/spaces/hooks.ts`.
   - **apertures / assets/ThermalBridges** — same enumeration.
   Tables gated `enabled: false` (the controller passes
   `enabled: isEditor && viewStateEnabled`) should be excluded from the batch
   request, or requested-and-ignored — pick one and note it (excluding is
   cheaper and avoids seeding caches the page won't read).

## Acceptance / gate

Findings section below is filled with: the confirmed `get_many` column list, the
chosen `keys` encoding + bound, and the exact per-page key sets (with the
"do all slots mount on load?" answer for equipment). No code merged in this
phase.

## Findings

_(fill in when Phase 00 runs)_
