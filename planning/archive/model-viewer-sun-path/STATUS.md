---
DATE: 2026-06-23
TIME: -
STATUS: COMPLETE — shipped 2026-06-23 (Phases 0 + 1), merged to `main`,
  feature archived. `make ci` green (backend pytest + frontend
  tsc/vitest/build). Phase 2 (scrubber) was never in scope here and
  remains a deferred candidate on the model-viewer-post-mvp roster. Live
  Playwright (`model-viewer-site-sun.spec.ts`) is written but was not run
  locally (env-gated — needs dev servers); it runs in CI.
AUTHOR: Claude (for Ed)
SCOPE: Status and gates for the sun-path feature.
RELATED:
  - README.md
  - PRD.md
  - decisions.md
  - PLAN.md
---

# Sun Path — Status

> **COMPLETE — shipped 2026-06-23, merged to `main`, feature archived to
> `planning/archive/model-viewer-sun-path/`.** The only open item is the
> live Playwright walkthrough (env-gated, runs in CI). Phase 2 (scrubber)
> stays a deferred candidate on the post-mvp roster.

## Current state (2026-06-23)

**Phases 0 + 1 implemented and shipped on `feat/model-viewer-sun-path`.**
Backend: `project_location/sun_path.py` builder, `service.get_project_sun_path`,
`GET /projects/{id}/sun-path` route, MCP tool, and
`tests/test_project_location_sun_path.py` (incl. the north-sign fixture) —
9 focused tests + the MCP/location suites green. Frontend: `useSunPathQuery`,
`sunPathGeometry.ts` (+ vitest), the completed `SiteSunLayer` render (arcs +
compass, bounds-fit), prop threading, hint flip, and the extended Playwright
spec — tsc clean + 50 vitest green. As cleanup, the dead always-null
`sun_path` key was removed from the `/model_data` artifact (see below).
**Remaining:** `make ci`, commit/merge, and a live Playwright run (the
running dev servers serve `main`, not this worktree — see Blockers).

### History (why this was a rebuild)

The 2026-06-13 plan assumed a "Climate Phase 1" had shipped the
`GET /projects/{id}/sun-path` endpoint and that this feature was
**frontend-only**. Tracing the actual `main` history shows that framing
is stale:

1. The sun-path backend **was built** on 2026-06-13 (commit `005839dc`,
   "Add sun-path service, route, and MCP tool") — in
   **`backend/features/project_location/`** (not a "climate" module),
   reading the `project_location` table.
2. It was **deliberately removed** on 2026-06-22 (commit `0056f6df`,
   "Remove sun-path service and refactor climate UI") as part of the
   Climate pages / PHI·Phius·EPW data-shape overhaul. That commit
   deleted the builder (`project_location/sun_path.py`), the
   `/sun-path` route, the MCP tool, the pytest, and the (separate)
   Climate-page sun-path UI. Its note states the removal was per Ed and
   that **"sun visualization remains in the Model tab"** — i.e. *this*
   feature (the Model-Viewer Site & Sun render) is still wanted; only
   the Climate-page sun-path panel was retired.

At the start of this work, on `main`: the wire DTOs survived
(`model_viewer/schemas/ladybug.py` — `SunPathAndCompassDTOSchema` et al.,
plus `ladybug_geometry.py`) and `CombinedModelData.sun_path` was an
always-`null` key, but **there was no `/sun-path` endpoint and no
builder**, and the frontend `SiteSunLayer` was the MVP stub (analemmas
only, gated on the always-null `model.sunPath`). This work rebuilt the
backend, completed the render, and removed that dead `sun_path` key.

**Good news from the overhaul:** project location data did **not** move.
`latitude / longitude / elevation_m / true_north_deg / time_zone` still
live in the `project_location` table, read via
`project_location.repository.get_location(...)` — the exact seam the
deleted service used. So the backend rebuild is largely a faithful
restore of `005839dc`, re-homed and re-verified against today's repo.

## Next step

Both implementable phases are done. Remaining to close out:
`make ci` green, commit/merge `feat/model-viewer-sun-path`, and a live
Playwright run of `model-viewer-site-sun.spec.ts` against worktree dev
servers (visual confirmation of the diagram + north orientation). Phase 2
(scrubber) stays deferred until a concrete time/season need exists.

## Blockers

- **None for the implementation.** The former blocker ("Climate Phase 1
  endpoint") was moot — the endpoint lives in `project_location` and was
  rebuilt here.
- **Live e2e is gated on environment, not code:** the running dev servers
  (`:5173`/`:8000`) serve the `main` checkout, which lacks the new
  endpoint, so `model-viewer-site-sun.spec.ts` must be run against
  servers started from this worktree (or in CI on the merged branch).

## Prerequisites

- `project_location` feature (data + setter UI) — **met.** Owns
  `latitude/longitude/elevation_m/true_north_deg/time_zone`; the Set
  Location flow already persists them via `PUT /projects/{id}/location`.
- Model Viewer MVP (Site & Sun lens + geometry/bounds the render fits
  to) — **met.** `SiteSunLayer.tsx` + `model.bounds` exist.
- Climate reference-dataset feature — **orthogonal.** It is app-wide
  reference data (Phius/PHI/EPW datasets, nearest-station lookup) and is
  **not** project-scoped and does **not** own location or the sun path.

## Phase ledger

| Phase | State | Gate |
|---|---|---|
| 0 — Backend sun-path service (project_location) | **Shipped 2026-06-23** (merged + archived); pytest green | Location data exists — met |
| 1 — Site & Sun 3D render (frontend) | **Shipped 2026-06-23** (merged + archived); tsc + vitest green, live e2e pending | Phase 0 (done) |
| 2 — Scrubber | Deferred | Phase 1 merged + named time/season need |

## Cleanup done + follow-ups

- **Removed the dead `sun_path` key from the `/model_data` artifact.** The
  MVP carried an always-`null` `sun_path` on `CombinedModelDataSchema` /
  `CombinedModelData` (a placeholder for the rejected bake-into-artifact
  option). With the sun path now served only by the dedicated endpoint
  (D-SP-1), that key was dead; it was removed from `schemas/combined.py`,
  `extraction.py`, the frontend `CombinedModelData` type, and the two
  tests that asserted it null. Single source of truth now.
- **Relocated the sun-path wire DTOs (done 2026-06-23).**
  `SunPathSchema` / `CompassSchema` / `SunPathAndCompassDTOSchema` moved
  from `model_viewer/schemas/ladybug.py` (deleted) to
  `project_location/sun_path_schemas.py`, next to their producer — fixing
  the ownership inversion (the endpoint contract no longer lives in the
  consumer feature). The low-level geometry primitives
  (`model_viewer/schemas/ladybug_geometry.py`: `Arc2D/Arc3D/
  LineSegment2D/Polyline3D`) were **deliberately left** there: they are
  genuinely shared with `model_viewer`'s face/mesh schemas, so a
  cross-feature import of *primitive value types* is acceptable (unlike an
  endpoint contract). Promoting them to a shared schema module remains a
  possible future tidy, but is not an inversion.
