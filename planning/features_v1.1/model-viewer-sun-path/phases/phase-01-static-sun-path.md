---
DATE: 2026-06-13
TIME: -
STATUS: Ready (after Climate Phase 1). REALIGNED 2026-06-13 to
  frontend-only — the backend moved to Climate Phase 1.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — render the annual sun path over the
  building in the Site & Sun lens (frontend consumer of the Climate
  endpoint).
RELATED:
  - ../PRD.md
  - ../decisions.md (D-SP-1, D-PL-4)
  - ../PLAN.md
  - planning/archive/climate/phases/phase-01-sun-path-service.md (the backend)
  - research/v1-3d-model-viewer-reference.md §9.4, §10
---

# Phase 1 — Site & Sun 3D render (frontend)

> **Realigned 2026-06-13.** The backend (builder + `GET
> /projects/{id}/sun-path` endpoint + MCP + the north-sign fixture)
> moved to **Climate Phase 1**
> (`planning/archive/climate/phases/phase-01-sun-path-service.md`).
> This phase is now **frontend-only** and **depends on Climate Phase 1
> shipping the endpoint.** It points the Site & Sun lens at that
> endpoint and completes the renderer.

Connects the already-shipped renderer scaffold to the Climate sun-path
endpoint. The location setter UI already shipped with `project_location`
(`ProjectLocationSettingsSection.tsx`); this phase only reads the
computed sun path and draws it.

## 0. Backend — see Climate Phase 1

The builder (`Sunpath.from_location`, unit radius, origin-centered, DST
off), the `GET /projects/{id}/sun-path` endpoint (null on no-location),
the MCP tool, and the **true-north sign fixture** (D-PL-4) are all owned
by Climate Phase 1. Do not build them here. This phase assumes that
endpoint exists and returns `SunPathAndCompassDTOSchema | null`.

## 1. Required reading

- `../PRD.md` §5 (the consumed contract) + §6 (frontend contract).
- `planning/archive/climate/phases/phase-01-sun-path-service.md` — the
  endpoint shape + the unit-radius/origin-centered geometry convention
  this render scales.
- V1 reference `research/v1-3d-model-viewer-reference.md`:
  - §9.4 `load_sun_path.tsx` — V1 rendered every polyline/arc in
    `sunpath` and `compass`, called `computeLineDistances()` for dashed
    lines, in a non-selectable group.
  - §10 — the LBT geometry → three converters (polyline, arc3d, arc2d,
    line2d). The compass arcs/ticks are 2D at z=0.

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

## 4. Verification gates (frontend)

- **vitest**: DTO→geometry mapping (arc discretization, compass tick
  mapping) and bounds-fit scaling math.
- **Playwright** (`model-viewer-site-sun.spec.ts`, extend): seed a
  project location, open `?file=…&lens=site-sun`, assert the sun-path
  group is present and the hint is gone; assert no-location still shows
  the hint. Expose `sunPathReady` (already in the debug hook) to gate
  the assertion.
- **`make format` + `make ci`** green.
- (Backend pytest incl. the north-sign fixture is Climate Phase 1's
  gate, not this feature's.)

## 5. Exit criteria

- PRD §7 acceptance items 1–5 met (the items this frontend owns).
- Diagram frames the model at any scale (check both the 459 KB and the
  52 MB fixtures).
- North orientation correct in the lens (visual confirmation; the sign
  itself is locked by Climate Phase 1's fixture).
- Location-reactive: editing location + reload updates the diagram
  (manual browser check + the freshness note in STATUS).
