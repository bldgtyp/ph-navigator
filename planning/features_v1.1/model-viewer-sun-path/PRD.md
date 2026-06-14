---
DATE: 2026-06-13
TIME: -
STATUS: Active — behavior contract for the sun-path feature.
AUTHOR: Claude (for Ed)
SCOPE: Product / behavior contract for rendering the annual sun path
  in the Model Viewer Site & Sun lens from project-location data.
RELATED:
  - README.md
  - decisions.md (D-SP-1)
  - PLAN.md
  - context/user-stories/40-model-viewer.md (US-VIEW-3 SunPath; D-07)
  - planning/archive/model-viewer/PRD.md §4.5
  - planning/archive/project-location/PRD.md §10
---

# Sun Path — PRD

## 1. Goal

When a project has a location set, the **Site & Sun** lens renders the
building's annual sun path — the same Ladybug visualization V1 showed:
hourly analemma polylines, monthly day-arcs, and a compass (boundary
circles + azimuth ticks) — oriented to the project's true north and
framed around the building. When no location is set, the lens behaves
exactly as it does today (building + grey shades + north marker + the
"Set project location" hint).

This is the last piece of declared Site & Sun behavior. It does not
redesign the Model tab, make shades selectable, or rework Measure
(post-MVP non-goals stand).

## 2. Audiences (unchanged from the Model Viewer PRD)

- **Technical reviewers** read the sun path to sanity-check
  orientation and shading-vs-solar geometry against design intent.
- **Non-technical viewers** get an immediately legible "where the sun
  goes over this building" diagram with zero interaction required.

## 3. Behavior contract

1. **Location present (lat + long set):** Site & Sun renders the sun
   path: dashed hourly analemmas, monthly day-arcs, and the compass,
   in the sun-path color, oriented to `true_north_deg` and scaled to
   frame the building. The "Set project location" hint does not show.
2. **Location absent (no row, or lat/long null):** unchanged from MVP —
   building + grey shades + north marker + the quiet hint. No error,
   no empty diagram.
3. **Location edited later:** the next time the Site & Sun lens loads
   (or the viewer refetches), the sun path reflects the new
   coordinates. There is no stale baked-in diagram (this is the point
   of D-SP-1).
4. **Sun path is never selectable** (Q-VIEW-3 / D-I7) — analemmas,
   arcs, and compass are inert, like the shades.
5. **Annual envelope only in Phase 1** — all hourly analemmas + monthly
   arcs rendered simultaneously (V1 parity). The time/season scrubber
   is Phase 2 and separately gated (Q-VIEW-6).
6. **North orientation is correct** — the diagram's north aligns with
   the model's true north. The sign of the angle handed to ladybug is
   verified against a known-orientation fixture (D-PL-4); a wrong sign
   is the single most likely defect and silently rotates the diagram.
7. **Deep links unaffected** — `?file=…&lens=site-sun` already works;
   it now shows the sun path when location exists. No new URL params.

## 4. Data flow (D-SP-1 accepted — decoupled endpoint)

```
project_location (lat, long, true_north_deg, time_zone)
        │  (in-process repository read)
        ▼
GET /api/v1/projects/{id}/sun-path
        │  ladybug Location + Sunpath.from_location(...)
        │  → analemmas + monthly arcs + Compass, at unit radius,
        │    centered at origin, rotated by true north
        ▼
SunPathAndCompassDTOSchema | null   (null ⇒ no location)
        │
        ▼  TanStack Query (project-scoped), normal cache lifecycle
Site & Sun lens: scale + translate the diagram to model.bounds,
render analemmas (dashed) + arcs + compass; non-selectable.
```

The geometry `/model_data` artifact is untouched; its `sun_path` key
stays `null`. The two queries (model_data, sun-path) are independent;
the lens composes them.

## 5. Backend contract — owned by Climate Phase 1

> **Realigned 2026-06-13.** The sun-path builder + `GET
> /projects/{id}/sun-path` endpoint + MCP tool live in **Climate
> Phase 1** (`planning/archive/climate/phases/phase-01-sun-path-service.md`),
> their proper home (climate-derived, multi-consumer — D-CL-2). The
> contract this feature consumes:

- `GET /api/v1/projects/{project_id}/sun-path` →
  `SunPathAndCompassDTOSchema | null` (null when no location).
  Public-readable, location-reactive, **unit radius / origin-centered**,
  true-north verified (D-PL-4). Not the immutable-artifact treatment.

This feature does **not** build backend; it consumes the above. (If
Climate Phase 1 has not shipped when this is scheduled, build it there
first.)

## 6. Frontend contract

- **New query** `useSunPathQuery(projectId)` →
  `SunPathAndCompassModelData | null`. Project-scoped (not file-scoped).
  Enabled only when the active lens is (or can become) Site & Sun, or
  simply alongside `/model_data` — implementer's call; lazy is nicer.
- **Renderer completion** in `scene/SiteSunLayer.tsx`:
  - Render `monthly_day_arc3d` (currently absent) and the compass
    (`all_boundary_circles`, `major_azimuth_ticks`,
    `minor_azimuth_ticks`) in addition to the existing
    `hourly_analemma_polyline3d`.
  - Confirm/extend the frontend `SunPathAndCompassModelData` type
    (`types.ts`) to carry the `compass` branch (the backend DTO has
    it; the MVP frontend type may only model `sunpath`).
  - **Scale + translate** the diagram to `model.bounds`
    (bounding-sphere radius + center) so it frames the building,
    reusing the bounds math the MVP compass marker already uses.
- **Source of `sunPath`:** today `BuildingModel.sunPath` is read from
  `combinedData.sun_path` (always null). Switch the Site & Sun lens to
  read the new query's result instead; the location-hint condition in
  `ModelViewerStage.tsx` (`!model.sunPath`) becomes `!sunPathData`.
- **No new chrome** — no scrubber, no legend entry, no toggle. The sun
  path is part of the fixed Site & Sun composition (PRD §4.1 table:
  Site & Sun has no theme menu).

## 7. Acceptance gate

1. A project with location set shows a correctly-oriented annual sun
   path (analemmas + arcs + compass) in Site & Sun, framed to the
   building; a project without location is unchanged from MVP.
2. Editing the project location and reloading the lens updates the
   diagram (no stale artifact) — the D-SP-1 freshness check.
3. True-north sign verified: a fixture with a known true north renders
   the diagram rotated the correct way (phase-01 §4 test).
4. Sun-path elements are not hoverable/selectable; Measure and the
   other lenses are unaffected.
5. `make ci` green; focused pytest for the sun-path builder
   (incl. the null-location and north-sign cases) and focused
   vitest/Playwright for the lens.
6. (Phase 2 only, when promoted) the scrubber gate in
   `phases/phase-02-scrubber.md`.
