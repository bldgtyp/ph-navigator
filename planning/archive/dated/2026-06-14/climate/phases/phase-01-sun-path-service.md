---
DATE: 2026-06-13
TIME: -
STATUS: Implemented 2026-06-13 — builder + route + MCP + north-sign
  fixture landed; `make ci` green; pending commit/merge. See §6.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — the project-scoped sun-path service.
RELATED:
  - ../PRD.md §5.1
  - ../decisions.md (D-CL-2, D-PL-4)
  - ../PLAN.md
  - planning/archive/project-location/PRD.md §10 (the seam)
  - research/v1-3d-model-viewer-reference.md §2.3.3, §9.4, §10
  - planning/archive/model-viewer-sun-path/ (the frontend consumer)
---

# Climate Phase 1 — Sun-path service

The shared, location-reactive sun-path endpoint. This is the
foundation the Model Viewer Site & Sun render and the Climate tab both
consume. Backend-only; no new UI (the location setter already exists).

## 1. Required reading

- `../decisions.md` — D-CL-2 (endpoint home + shape) and D-PL-4
  (true-north convention + the mandatory sign verification).
- `planning/archive/project-location/PRD.md` §10 — the original consumer
  seam (inputs, computation, true-north verification, trigger).
- V1 reference `research/v1-3d-model-viewer-reference.md`:
  - §2.3.3 `get_sun_path_from_model(epw)` — V1 used
    `Sunpath.from_location(...)` + `Compass(radius=40, center=(0,0),
    north=0)`, scale 0.4, DST off. **V2 differs:** north from
    `true_north_deg`, location from `project_location` (not EPW), unit
    radius (the frontend fits to model bounds).
  - §9.4 / §10 — the analemma/arc/compass → geometry mapping the
    frontend will mirror.
- Existing code:
  - `backend/features/project_location/repository.py` —
    `get_location(conn, project_id)`.
  - `backend/features/project_location/service.py` — any existing
    `time_zone` → offset helper (reuse, don't duplicate).
  - `backend/features/model_viewer/schemas/ladybug.py` +
    `ladybug_geometry.py` — the DTOs to emit (shipped in MV Phase 2).

## 2. Module placement (D-CL-2)

Author in the **location/climate backend domain**
(`backend/features/project_location/`, the eventual `climate` module),
NOT `features/model_viewer/`. Consumers import this; this imports no
consumer. Keep `model_viewer → climate` one-way.

The DTOs (`SunPathAndCompassDTOSchema` etc.) currently live under
`features/model_viewer/schemas/`. Either (a) import them from there
(model_viewer is a peer, acceptable if no cycle), or (b) move the
ladybug/ladybug_geometry sun-path DTOs into a shared/location schema
module and have model_viewer re-export. Prefer (b) for a clean
ownership story, but (a) is fine for a small first cut — implementer's
call, note it.

## 3. Work

### 3.1 Pure builder

`build_sun_path(*, latitude, longitude, elevation_m, true_north_deg,
time_zone) -> SunPathAndCompassDTOSchema`:

- ladybug `Location(...)` with the numeric UTC offset derived from the
  IANA `time_zone` via `zoneinfo` (reuse the project_location helper if
  present).
- `Sunpath.from_location(location, north_angle=<signed true_north>,
  daylight_saving_period=None)` (DST off — V1 parity).
- Hourly analemma polylines + monthly day-arcs at **unit radius,
  origin-centered**; `Compass(radius=<unit>, center=Point2D(0,0),
  north_angle=<signed true_north>)` → boundary circles + major/minor
  azimuth ticks.
- Convert to the existing DTOs. Do not invent new wire shapes.

### 3.2 True-north sign (D-PL-4) — verify, do not assume

Stored convention: CCW from +Y, 90°=W, 270°=E, `[0,360)`. ladybug's
`north_angle` has its own sign. Write a fixture test: set
`true_north_deg` to a known value and assert a known solar feature (a
specific azimuth tick or the noon arc) lands on the expected side.
Record the confirmed mapping (identity / negation / offset) as an
inline comment. **This is the acceptance-critical step for the whole
sun-path line of work.**

### 3.3 Route + service + MCP

- `GET /api/v1/projects/{project_id}/sun-path`, view-access
  (public-readable), returns `SunPathAndCompassDTOSchema | None`.
- Service reads `project_location.get_location(...)`; return `None` when
  the row is absent or lat/long is null. Never 500 on missing location.
- MCP `get_project_sun_path`, `project:read` scope, same null-on-unset
  shape (register in `features/mcp/server.py` + tools).
- Cache: optional `ETag` from a stable hash of the location inputs;
  `Cache-Control: private, max-age=0` (revalidate). Do **not** reuse the
  immutable `_CACHE_CONTROL` from `model_data.py` — location changes.

## 4. Verification gates

- **pytest** (`backend/tests/test_climate_sun_path.py` or in the
  project_location test module):
  - builder returns non-empty analemmas + arcs + compass for a known
    location;
  - **north-sign fixture** (§3.2) — load-bearing;
  - route → `null` for no-location and null-lat/long;
  - route → DTO for a seeded location;
  - MCP parity.
- **`make ci`** green.

## 5. Exit criteria

- PRD §7 Phase 1 met.
- North sign verified + documented inline.
- The Model-Viewer sun-path render
  (`planning/archive/model-viewer-sun-path` Phase 1) can consume
  the endpoint with no further backend work — i.e. this phase fully
  owns the backend that feature originally drafted.

## 6. Outcome (implemented 2026-06-13)

Landed in `backend/features/project_location/`:
- `sun_path.py` — pure `build_sun_path(...)` + `utc_offset_hours(...)`
  (IANA → standard-meridian offset, DST stripped; longitude fallback
  when no zone is set). Origin-centered, **unit radius** (frontend scales
  to model bounds), DST off.
- `service.py::get_project_sun_path(project_id)` — reads
  `project_location` in-process; returns `None` (never raises) when the
  row or lat/long is unset; defaults elevation→0, true-north→0.
- `routes.py` — `GET /api/v1/projects/{id}/sun-path`, view-access,
  `SunPathAndCompassDTOSchema | None`, `Cache-Control: private,
  max-age=0` (location is mutable; do not reuse the immutable model_data
  policy).
- `mcp.py::tool_get_project_sun_path` + registration in
  `features/mcp/{tools,server}.py` — `project:read`, same null-on-unset
  shape; MCP/route parity pinned by test.

**North sign (D-PL-4) — RESOLVED: identity.** The stored
`true_north_deg` (CCW from +Y; 90°=W, 270°=E) passes to ladybug's
`north_angle` **unchanged**. Verified empirically (ladybug rotates the
diagram CCW by `north_angle`, the same sense as our convention:
`sun_math_angle = 90 + north_angle − azimuth`) and locked by
`tests/test_climate_sun_path.py::test_builder_north_sign_is_identity`
(true-north 90° swings the compass North tick to −X = due West). Recorded
inline in `sun_path.py`.

**DTO placement.** Reused `model_viewer.schemas.ladybug` DTOs (phase
option (a)): no import cycle (`model_viewer` does not import
`project_location`; the frontend consumes the endpoint directly).
Relocation to a shared/`climate` schema home is a **Phase-3 follow-up**
(when `project_location` is renamed to `climate`).

Tests: `tests/test_climate_sun_path.py` (builder populated, north-sign
fixture, offset/DST, route null × 2 + diagram, MCP parity + null +
scope). `make ci` green.
