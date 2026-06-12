---
DATE: 2026-06-12
TIME: 18:08 EDT
STATUS: Complete — implementation, simplify, docs-pass, format, CI,
  and graph update complete.
AUTHOR: Claude (for Ed)
SCOPE: Backend implementation of the `project_location` feature
  module: 1:1 table, models + validation, repository, service, REST
  GET/PUT, and the MCP read tool. SI-canonical + MCP from day one.
RELATED:
  - planning/features/project-location/PRD.md §3,§4,§5,§8,§9
  - planning/features/project-location/decisions.md D-PL-1,D-PL-5
  - backend/features/projects/ (the module to mirror)
  - backend/features/mcp/server.py + tools.py + helpers.py
  - context/CODING_STANDARDS.md (load before writing backend code)
---

# Phase 1 — Location backbone (backend)

## 1. Goal

A new `backend/features/project_location/` module exposing a project's
location as SI-canonical data over REST (`GET/PUT
/api/v1/projects/{id}/location`) and MCP (`get_project_location`),
backed by a 1:1 `project_location` table. No frontend, no EPW yet —
this is the data + contract layer, and it is the only thing the
deferred model-viewer sun-path wiring needs (PRD §10).

## 1.1 Implementation status

- [x] Migration creates the 1:1 `project_location` table.
- [x] Pydantic models validate SI-canonical location fields and IANA
  time zones.
- [x] Repository reads/upserts only changed fields with raw
  parameterized SQL.
- [x] Service synthesizes the unset response shape, applies partial
  updates, preserves explicit `null` clears, and returns empty
  `warnings[]` plumbing for Phase 3.
- [x] REST routes are registered at
  `/api/v1/projects/{id}/location` with public read and editor write.
- [x] MCP `get_project_location` is registered and enforces
  `project:read`.
- [x] Focused tests cover validation, initial read, update/clear,
  unauthenticated write rejection, MCP read, and MCP project-scope
  rejection.
- [x] Simplify pass complete; findings were folded into the
  implementation.
- [x] Docs-pass complete; no context/ADR update needed beyond this
  phase/status ledger.
- [x] `make format` and `make ci` pass.
- [x] Graph update complete.

## 2. Required reading (in order)

1. `context/CODING_STANDARDS.md` — backend feature rules (separate
   routes/models/service/repository, strict typing, document the why).
2. `backend/features/projects/` — the module to mirror. Note the
   responsibility split and the `require_project_access` access seam
   (`access.py`, used as `ProjectViewAccess` / `ProjectEditAccess` in
   `routes.py`).
3. `backend/features/mcp/tools.py` `tool_list_projects` (~156–176) +
   `helpers.py` (`current_token`, `require_token_scope_or_error`,
   `raise_http_exception_as_mcp_error`) + `server.py`
   `build_mcp_server()` registration pattern.
4. PRD §4 (columns), §5 (API), §8 (validation), §9 (units).
5. `backend/alembic/versions/20260512_0003_projects.py` and
   `…20260526_0013_project_lifecycle.py` for migration idioms.

## 3. Work breakdown

### 3.1 Migration — `project_location` table
New Alembic revision under `backend/alembic/versions/`
(`…_project_location.py`). Create the 1:1 table per PRD §4:
- `project_id uuid PRIMARY KEY`, `ForeignKeyConstraint(["project_id"],
  ["projects.id"], ondelete="CASCADE")`.
- `latitude`, `longitude`, `elevation_m`, `true_north_deg` as
  `sa.Double()`, nullable.
- `time_zone`, `site_address`, `city`, `state`, `epw_asset_id`,
  `epw_source_url` as `sa.Text()`, nullable.
- `created_at` / `updated_at` `sa.DateTime(timezone=True)`,
  `server_default=sa.text("now()")`.
- **No** FK on `epw_asset_id` (assets soft-delete — D-PL-1; service
  resolves). Optionally a CHECK on ranges, but prefer Pydantic-level
  validation (§3.2) so error messages are uniform with the app.

Verify `uv run alembic upgrade head` then `downgrade` round-trips.

### 3.2 Models (`models.py`)
Pydantic v2. A `LocationFields` base (all optional) with
`field_validator`s enforcing PRD §8 ranges (lat `[-90,90]`, long
`[-180,180]`, `true_north_deg [0,360)`, `elevation_m` sane bounds,
`time_zone` resolves via `zoneinfo.ZoneInfo`). Request model for `PUT`
(partial allowed; distinguish "unset" from explicit `null` via
`model_fields_set` / `exclude_unset`). Response model:
`ProjectLocation` (the fields + `is_set: bool` + `updated_at`) and a
nested resolved `epw: EpwDescriptor | None` (id, filename, source_url,
parsed snapshot) populated in Phase 3 — leave the field present and
`None` here.

### 3.3 Repository (`repository.py`)
Raw parameterized SQL, psycopg, mirroring
`backend/features/projects/repository.py` style:
- `get_location(conn, project_id) -> dict | None`.
- `upsert_location(conn, project_id, changed_fields, values)` —
  `INSERT … ON CONFLICT (project_id) DO UPDATE SET … , updated_at =
  now()` over only the changed fields (mirror the dynamic-assignment
  approach in `projects.repository.update_project_metadata`).

### 3.4 Service (`service.py`)
- `get_project_location(project_id, access_mode)` → `ProjectLocation`
  (synthesize an `is_set=false` all-null shape when the row is
  absent).
- `update_project_location(project_id, payload, user)` → validates,
  upserts in a `transaction()`, returns the saved location plus
  `warnings[]` (empty in Phase 1; EPW-mismatch added in Phase 3).
  Keep the warning plumbing in place now so Phase 3 only adds a rule.

### 3.5 Routes (`routes.py`)
`APIRouter(prefix="/api/v1/projects", tags=["project-location"])`:
- `GET /{project_id}/location` with `ProjectViewAccess` (public read).
- `PUT /{project_id}/location` with `ProjectEditAccess` +
  `require_editor_user` (write-gated, per the access seam).
Register the router wherever the projects router is included
(`backend/main.py` / the app's router assembly — match how
`features/projects/routes.py` is wired).

### 3.6 MCP read tool (`mcp.py`)
Follow the lighter colocated pattern
(`backend/features/aperture_hbjson_export/mcp.py`): define
`tool_get_project_location(project_id, ctx, *, allow_env_token)` that
parses the id, `current_token`, `require_token_scope_or_error(…,
"project:read", …)`, calls the service, and returns the SI shape;
translate `HTTPException` via `raise_http_exception_as_mcp_error`.
Register a `@mcp.tool()` stub in `build_mcp_server()`
(`backend/features/mcp/server.py`) next to the other project tools.

## 4. Out of scope

Frontend (Phase 2). EPW asset_kind, parsing, mismatch warning rule
(Phase 3). Sun-path computation/wiring (model-viewer; PRD §10).

## 5. Verification gate

1. **pytest** (new `backend/features/project_location/tests/` or the
   repo's test layout): range validation (accept/reject boundaries for
   lat/long/north/elevation, bad `time_zone`); upsert create-then-
   update; `GET` returns `is_set=false` for a project with no row;
   write rejected without an editor session (401); public `GET`
   succeeds unauthenticated.
2. **MCP**: `get_project_location` returns the saved data under a
   `project:read` token; scope/owner mismatch raises the structured
   MCP error.
3. **Closeout**: `make format` + `make ci` green. `graphify update .`.

Focused verification passed on 2026-06-12:

- `cd backend && uv run pytest tests/test_project_location.py`
- `cd backend && uv run ruff check features/project_location tests/test_project_location.py`
- `cd backend && uv run ty check features/project_location tests/test_project_location.py`

## 6. Exit criteria

`GET/PUT /api/v1/projects/{id}/location` and the
`get_project_location` MCP tool are live, SI-canonical, access-gated,
and tested. STATUS.md updated; the model-viewer sun-path **data** seam
(PRD §10) is now satisfiable — note in STATUS.md that the wiring is
schedulable once MV Phases 2 + 6 land.
