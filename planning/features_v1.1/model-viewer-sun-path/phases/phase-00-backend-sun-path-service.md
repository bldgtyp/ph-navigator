---
DATE: 2026-06-23
TIME: -
STATUS: IMPLEMENTED 2026-06-23 (branch `feat/model-viewer-sun-path`,
  pending merge). Builder + service + route + MCP tool + north-sign
  fixture restored in `project_location`; focused pytest green.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — the project-scoped sun-path builder +
  `GET /projects/{id}/sun-path` endpoint + MCP tool + north-sign fixture.
RELATED:
  - ../PRD.md §5 (backend contract)
  - ../decisions.md (D-SP-1, D-PL-4, 2026-06-23 reconciliation)
  - ../PLAN.md
  - phase-01-static-sun-path.md (the frontend consumer)
---

# Phase 0 — Backend sun-path service (`project_location`)

Rebuilds the sun-path backend that was added in commit `005839dc`
(2026-06-13) and deleted in `0056f6df` (2026-06-22). It is a faithful
restore, re-homed in `project_location` (its original home — the
coordinate owner) and re-verified against today's repo. The wire DTOs it
emits already exist on `main` (`model_viewer/schemas/ladybug.py` +
`ladybug_geometry.py`); do **not** redefine them.

> **Recover the original code** with `git show 005839dc:<path>` for each
> deleted file below. The diff to today is small — see §5.

## 1. Required reading

- `../PRD.md` §4 (data flow) + §5 (backend contract).
- `../decisions.md` D-SP-1 (decoupled endpoint), D-PL-4 (true-north
  convention + the load-bearing sign check), and the 2026-06-23
  reconciliation (why this lives in `project_location`).
- The surviving DTOs: `backend/features/model_viewer/schemas/ladybug.py`
  (`SunPathAndCompassDTOSchema`, `SunPathSchema`, `CompassSchema`) and
  `.../ladybug_geometry.py` (`Arc2DSchema`, `Arc3DSchema`,
  `LineSegment2DSchema`, `Polyline3DSchema`).

## 2. Files to create / edit

| File | Action | Notes |
|---|---|---|
| `backend/features/project_location/sun_path.py` | **create** | Restore `build_sun_path(...)` + `utc_offset_hours(...)` from `005839dc`. Pure ladybug; no DB. |
| `backend/features/project_location/service.py` | **edit** | Add `get_project_sun_path(project_id) -> SunPathAndCompassDTOSchema \| None`. Reads `repository.get_location(...)`; `None` on no row / unset lat-long; neutral defaults otherwise. |
| `backend/features/project_location/routes.py` | **edit** | Add `GET /{project_id}/sun-path` (view-access gated; `Cache-Control: private, max-age=0`). |
| `backend/features/project_location/mcp.py` | **edit** | Add `tool_get_project_sun_path(...)` (`project:read` scope). |
| `backend/features/mcp/tools.py` | **edit** | Import + re-export `tool_get_project_sun_path`. |
| `backend/features/mcp/server.py` | **edit** | Register the `get_project_sun_path` MCP tool. |
| `backend/tests/test_project_location_sun_path.py` | **create** | Restore from `005839dc:backend/tests/test_climate_sun_path.py`; rename module; keep the north-sign fixture. |

## 3. Builder contract (`build_sun_path`)

- Inputs: `latitude`, `longitude`, `elevation_m`, `true_north_deg`,
  `time_zone` (IANA `str | None`).
- **Unit radius (1.0), origin-centered** — the frontend scales to
  `model.bounds`. Do not hardcode V1's radius 40.
- **DST off** — the sun path is a geometric reference, not a wall-clock
  schedule. `utc_offset_hours` returns the *standard-meridian* offset
  (strip the DST component for IANA zones; fall back to
  `round(longitude / 15)` when no zone).
- **`true_north_deg` → ladybug `north_angle` by IDENTITY.** Stored
  convention is CCW from +Y (90 = West, 270 = East). ladybug rotates the
  diagram CCW by `north_angle` — same sense. Do not "simplify" the
  identity away; the fixture below guards it.
- Emits `SunPathAndCompassDTOSchema`:
  `sunpath` = `hourly_analemma_polyline3d` + `monthly_day_arc3d` (12),
  `compass` = `all_boundary_circles` + `major_azimuth_ticks` (4) +
  `minor_azimuth_ticks`.

## 4. Service contract (`get_project_sun_path`)

```
row = repository.get_location(conn, project_id)
if row is None or row["latitude"] is None or row["longitude"] is None:
    return None        # never raises — sun path is undefined without coords
return build_sun_path(
    latitude=row["latitude"], longitude=row["longitude"],
    elevation_m=row["elevation_m"] or 0.0,
    true_north_deg=row["true_north_deg"] or 0.0,
    time_zone=row["time_zone"],
)
```

## 5. Known deltas from `005839dc` (verify, don't assume)

- The deleted code is the source of truth for logic. Re-point any imports
  to today's module locations and confirm signatures still match
  (`repository.get_location`, the access guards in `routes.py`, the MCP
  helpers in `mcp/helpers.py`).
- `005839dc`'s `sun_path.py` docstring calls `project_location` "the
  eventual climate feature home" — that rename never happened; drop or
  correct that aside when restoring.
- Test module: rename `test_climate_sun_path.py` →
  `test_project_location_sun_path.py`. Confirm the shared helpers it
  imports from `tests/test_mcp` (`ORIGIN`, `clean_mcp_tables`,
  `create_project`, `signed_in_client`) still exist; adjust if renamed.

## 6. Verification gates

- **North-sign fixture (load-bearing, D-PL-4):** with `true_north_deg=0`
  the compass North tick is `(0, 1)`; with `true_north_deg=90` it is
  `(-1, 0)`. A sign flip sends it to `(+1, 0)` and must fail.
- Builder populates 12 monthly arcs + 4 major ticks + non-empty
  analemmas/circles.
- `utc_offset_hours("America/New_York", lon) == -5.0` (standard, not DST);
  `None` zone → meridian implied by longitude.
- Route: `null` without a location / with unset coords; full diagram with
  coords; `Cache-Control: private, max-age=0`.
- MCP tool at parity with the route; enforces `project:read` scope.
- Focused pytest green:
  `cd backend && uv run pytest tests/test_project_location_sun_path.py`.

## 7. Exit criteria

- `GET /api/v1/projects/{id}/sun-path` returns
  `SunPathAndCompassDTOSchema | null` per §5; MCP parity holds.
- North-sign fixture passes.
- `make ci` green (or focused pytest green pending the closeout `make ci`).
- Phase 1 (frontend) is unblocked: the endpoint exists and is shaped as
  `phase-01-static-sun-path.md` expects.
