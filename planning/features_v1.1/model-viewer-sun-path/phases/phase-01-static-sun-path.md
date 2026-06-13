---
DATE: 2026-06-13
TIME: -
STATUS: Ready — implement. D-SP-1 accepted (Ed 2026-06-13): the
  decoupled, project-scoped, location-reactive endpoint.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — static annual sun path in Site & Sun.
RELATED:
  - ../PRD.md
  - ../decisions.md (D-SP-1, D-PL-4)
  - ../PLAN.md
  - planning/archive/project-location/PRD.md §10
  - research/v1-3d-model-viewer-reference.md §2.3.3, §9.4, §10
---

# Phase 1 — Static sun path

Self-contained handoff. Connects the already-shipped wire schema and
renderer scaffold to live project-location data. Implements D-SP-1 as
accepted (decoupled, project-scoped endpoint). The location setter UI
already shipped with `project_location`
(`frontend/src/features/projects/components/ProjectLocationSettingsSection.tsx`)
— this phase only reads the stored data.

## 1. Required reading

- `../decisions.md` — D-SP-1 (serving strategy) and D-PL-4 (true-north
  convention + sign verification).
- `planning/archive/project-location/PRD.md` §10 — the consumer seam
  (inputs, computation, true-north verification, trigger).
- V1 reference `research/v1-3d-model-viewer-reference.md`:
  - §2.3.3 `get_sun_path_from_model(epw)` — V1 used
    `Sunpath.from_location(...)` + `Compass(radius=40, center=(0,0),
    north=0)`, scale 0.4, DST off. **V2 differs:** north comes from
    `true_north_deg`, location from `project_location` (not EPW), and
    the radius is unit-scale (frontend fits to bounds).
  - §9.4 `load_sun_path.tsx` — the loader rendered every polyline/arc
    in `sunpath` and `compass`, called `computeLineDistances()` for
    dashed lines, used the `sunpathLine` material, added to a
    non-selectable group.
  - §10 — the LBT geometry → three converters (polyline, arc3d, arc2d,
    line2d). The compass arcs/ticks are 2D at z=0.

## 2. Backend work

### 2.1 Pure builder

New `backend/features/model_viewer/sun_path.py` (or a function group in
`extraction.py` — prefer a new module; `extraction.py` is large and
HBJSON-shaped, this is location-shaped):

```python
def build_sun_path(
    *,
    latitude: float,
    longitude: float,
    elevation_m: float | None,
    true_north_deg: float | None,
    time_zone: str | None,
) -> SunPathAndCompassDTOSchema:
    """Annual sun path + compass at unit radius, origin-centered.

    Daylight saving is off (V1 parity). North is applied per D-PL-4 —
    see the sign note below. Returns geometry the frontend scales and
    translates to the model bounds.
    """
```

- Build a ladybug `Location(latitude=…, longitude=…, elevation=…,
  time_zone=<numeric UTC offset>)`. Derive the numeric offset from the
  IANA `time_zone` via `zoneinfo` (mirror whatever helper
  `project_location` already uses, if any — check
  `features/project_location/service.py`; do not duplicate).
- `sunpath = Sunpath.from_location(location, north_angle=<signed
  true_north>, daylight_saving_period=None)`.
- Generate hourly analemma polylines and monthly day-arcs at a **unit
  radius centered at origin**; build a `Compass(radius=<unit>,
  center=Point2D(0,0), north_angle=<signed true_north>)` and read
  `all_boundary_circles`, `major_azimuth_ticks`,
  `minor_azimuth_ticks`.
- Convert each to the existing DTOs in
  `schemas/ladybug.py` + `schemas/ladybug_geometry.py`
  (`Polyline3DSchema`, `Arc3DSchema`, `Arc2DSchema`,
  `LineSegment2DSchema`). These were shipped in MVP Phase 2 precisely
  for this — do not invent new shapes.

### 2.2 True-north sign (D-PL-4) — verify, do not assume

The stored convention is CCW-from-+Y (90°=West, 270°=East). ladybug's
`Sunpath`/`Compass` `north_angle` has its own sign convention. Before
trusting output, write a fixture test: set `true_north_deg` to a known
value (e.g. 90) and assert a known solar position (e.g. the noon arc
apex, or a specific azimuth tick) lands on the expected side. Record
the confirmed mapping (identity vs. negation vs. offset) as an inline
comment in `build_sun_path`. **This is the acceptance-critical step.**

### 2.3 Route + service + MCP

- `routes.py`: `GET /projects/{project_id}/sun-path`, view-access
  (public-readable), returns `SunPathAndCompassDTOSchema | None`.
- `service.py`: read `project_location` via
  `features/project_location/repository.get_location(conn,
  project_id)`. If the row is absent or `latitude`/`longitude` is
  None → return `None`. Otherwise call `build_sun_path(...)`.
  - Keep model_viewer → project_location a one-way import (model_viewer
    already depends on shared infra; project_location must NOT import
    model_viewer). Confirm no import cycle.
- MCP: add `get_project_sun_path` alongside the existing model-viewer
  MCP tools (`features/mcp/tools_model_viewer.py` + `tools.py` +
  `server.py` stub), `project:read` scope, same null-on-unset shape.
- Caching: optional `ETag` from a stable hash of the location inputs;
  `Cache-Control: private, max-age=0` (revalidate). Do **not** reuse
  the immutable `_CACHE_CONTROL` from `model_data.py`.

## 3. Frontend work

### 3.1 Query + types

- `types.ts`: confirm `SunPathAndCompassModelData` carries the
  `compass` branch (`all_boundary_circles: Arc2DModelData[]`,
  `major_azimuth_ticks: LineSegment2DModelData[]`,
  `minor_azimuth_ticks: LineSegment2DModelData[]`). The MVP type likely
  models only `sunpath`; extend it to mirror the backend DTO.
- `api.ts` + `hooks.ts`: `fetchSunPath(projectId, signal)` +
  `useSunPathQuery(projectId)`. Normal cache lifecycle (NOT
  `staleTime: Infinity` — location can change). `null` is a valid
  resolved value.
- `query-keys.ts`: add a project-scoped sun-path key.

### 3.2 Renderer (`scene/SiteSunLayer.tsx`)

- Today `SunPathLines` renders only `hourly_analemma_polyline3d`. Add:
  - `monthly_day_arc3d` → dashed `<Line>` per arc (discretize arcs to
    points; see V1 §10 `convertLBTArc3DtoLine`).
  - Compass: boundary circles (arc2d → points at z = model floor),
    major/minor azimuth ticks (linesegment2d → `<Line>`), in the
    compass/sun-path color.
- **Fit to bounds:** wrap the sun-path group in a `<group>` with a
  uniform `scale` = (model bounding-sphere radius × a framing factor)
  and `position` = model bounds center (reuse `model.bounds` and the
  `compassPoints` bounds math already in this file). Uniform scale +
  translate preserves the true-north rotation.
- Keep everything `raycast={() => null}` (non-selectable, Q-VIEW-3).
- The existing `SiteSunLayer` receives `model`; thread the sun-path
  query result in (prop or via the parent in `BuildingLens` /
  `ModelViewerStage`).

### 3.3 Wire the data + hint

- The lens currently reads `model.sunPath` (from the null
  `combinedData.sun_path`). Switch Site & Sun to consume the
  `useSunPathQuery` result.
- `components/ModelViewerStage.tsx:174` — the location-hint condition
  `model && lens === "site-sun" && !model.sunPath && !measureActive`
  becomes keyed on the sun-path query (`!sunPathData`), so the hint
  hides exactly when the diagram shows.
- `invalidate()` the canvas when the sun-path query resolves
  (`frameloop="demand"`), or the diagram won't paint until the next
  interaction.

## 4. Verification gates

- **pytest** (`backend/tests/test_model_viewer_sun_path.py`):
  - builder returns non-empty analemmas + arcs + compass for a known
    location;
  - **north-sign fixture** (§2.2) — the load-bearing test;
  - route returns `null` for a project with no location row and for a
    row with null lat/long;
  - route returns the DTO for a seeded location;
  - MCP tool parity.
- **vitest**: DTO→geometry mapping (arc discretization, compass tick
  mapping) and bounds-fit scaling math.
- **Playwright** (`model-viewer-site-sun.spec.ts`, extend): seed a
  project location, open `?file=…&lens=site-sun`, assert the sun-path
  group is present and the hint is gone; assert no-location still shows
  the hint. Expose `sunPathReady` (already in the debug hook) to gate
  the assertion.
- **`make format` + `make ci`** green.

## 5. Exit criteria

- PRD §7 acceptance items 1–5 met.
- North sign verified by fixture, mapping documented inline.
- Diagram frames the model at any scale (check both the 459 KB and the
  52 MB fixtures).
- Location-reactive: editing location + reload updates the diagram
  (manual browser check + the freshness note in STATUS).
