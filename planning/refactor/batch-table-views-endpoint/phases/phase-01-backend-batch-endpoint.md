---
DATE: 2026-06-29
TIME: 21:35 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8)
SCOPE: Add a batch read endpoint returning many table-views in one request.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ./phase-00-preflight.md
---

# Phase 01 — Backend batch read endpoint

## Goal

One request returns the view-state config for many `table_key`s, with per-key
semantics identical to the existing single-key `GET /{table_key}` (including the
default-empty response for unsaved keys). The single-key GET/PUT/DELETE routes
are left untouched — writes and direct reads still use them.

`uv` only; raw parameterized SQL; strict typing (`ty`); Pydantic v2.

## Preferred Implementation Shape

1. **Model** — `backend/features/table_views/models.py`:
   ```python
   class BatchTableViewsResponse(BaseModel):
       model_config = ConfigDict(extra="forbid")
       views: dict[str, TableViewResponse]   # table_key -> config (defaults for absent keys)
   ```
   Reuse `TableViewResponse` so each entry is byte-identical to the single-key
   route's output.

2. **Repository** — `backend/features/table_views/repository.py`, add `get_many`:
   - Same `SELECT` column list as `get`
     (`user_id, project_id, table_key, view_state_schema_version, view_state,
     view_state_size_bytes, updated_at`).
   - `WHERE user_id = %(user_id)s AND project_id = %(project_id)s AND table_key =
     ANY(%(table_keys)s)` — pass a Python `list[str]`; psycopg3 adapts it to a
     text array. **One query** — do not loop `get` per key.
   - Return `list[dict[str, Any]]` (may be shorter than the requested list when
     some keys have no row).

3. **Service** — `backend/features/table_views/service.py`, add
   `get_table_views(table_keys: list[str], access: ProjectAccess) ->
   BatchTableViewsResponse`:
   - `user = require_editor_user(access)`.
   - De-duplicate `table_keys` (preserve a stable order) and `validate_table_key`
     each; on any invalid key raise `400 invalid_table_key` (same shape as the
     single-key path) — reject the whole request, return nothing partial.
   - One `repository.get_many(conn, user.id, access.project_id, keys)` inside a
     read connection; index rows by `row["table_key"]`.
   - Build `views[key] = _row_to_response(rows_by_key.get(key))` for **every
     requested key** so absent keys carry the same default-empty
     `TableViewResponse` the single-key route returns. Reuse the existing
     `_row_to_response` (do not duplicate the default shape).

4. **Route** — `backend/features/table_views/routes.py`:
   - Add `@router.get("", response_model=BatchTableViewsResponse)`:
     ```python
     def get_table_views_route(
         keys: Annotated[list[str], Query(min_length=1, max_length=<bound from P0>)],
         access: ProjectEditAccess,
     ) -> BatchTableViewsResponse:
         return get_table_views(keys, access)
     ```
   - **Declare it before** the `@router.get("/{table_key}")` route. The collection
     path (prefix root, no trailing segment) and the item path
     (`/{table_key}`) do not collide, but declaring the collection first avoids
     any ordering surprise.
   - Keep `GET/PUT/DELETE /{table_key}` exactly as-is.

## Code Areas

- `backend/features/table_views/models.py`
- `backend/features/table_views/repository.py`
- `backend/features/table_views/service.py`
- `backend/features/table_views/routes.py`
- tests: `backend/features/table_views/` test module (mirror the single-key tests)

## Tests / Acceptance

- Batch returns **one entry per requested key**; present keys carry the stored
  `view_state` envelope; absent keys carry the default-empty response — and the
  per-key values equal what `GET /{table_key}` returns for the same state.
- Mixed present/absent in one response (user has saved some keys, not others).
- Malformed key → `400 invalid_table_key`, nothing partially returned.
- Duplicate keys in the request collapse to one entry (no double rows).
- Non-editor access rejected the same way as the single-key route.
- `keys` over the bound → `422` (FastAPI validation); empty `keys` → `422`.
- Gate: `make ci` backend lane green.

## Rejected alternatives

- **Looping `get` per key inside the service** — defeats the purpose (still N
  queries); the win must be one SQL round-trip.
- **Folding view-config into the draft-tables response** — couples two unrelated
  concerns (UI prefs vs document data) and entangles this with the higher-risk
  `batch-draft-table-reads` work. Keep the standalone endpoint.
