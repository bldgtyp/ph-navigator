---
DATE: 2026-06-23
TIME: -
STATUS: Phases 0 + 1 IMPLEMENTED 2026-06-23 (branch
  `feat/model-viewer-sun-path`, pending merge). Phase 0 rebuilt the backend
  sun-path service in `project_location` (it was deleted 2026-06-22);
  Phase 1 renders it in the Model-Viewer Site & Sun lens. D-SP-1 accepted.
  Phase 2 (scrubber) deferred. See STATUS.md.
AUTHOR: Claude (for Ed)
SCOPE: The annual sun-path diagram in the Model Viewer Site & Sun lens —
  both the project-scoped backend service that computes it and the 3D
  render that draws it over the building geometry. Plus the deferred
  time/season scrubber.
RELATED:
  - PRD.md
  - decisions.md
  - PLAN.md
  - phases/phase-00-backend-sun-path-service.md
  - phases/phase-01-static-sun-path.md
  - phases/phase-02-scrubber.md
  - planning/archive/model-viewer/ (completed MVP — source of truth)
  - planning/archive/model-viewer/decisions.md D-07
  - planning/features_v1.1/model-viewer-post-mvp/ (umbrella router)
---

# Model Viewer — Sun Path

> **Rebaselined 2026-06-23.** Earlier docs (2026-06-13) framed this as
> *frontend-only*, consuming a "Climate Phase 1" endpoint. That is stale.
> The sun-path backend was built on 2026-06-13 in
> `backend/features/project_location/` and then **deleted on 2026-06-22**
> during the Climate pages overhaul (commit `0056f6df`; the removal note
> says "sun visualization remains in the Model tab"). The wire DTOs
> survive, but the builder, endpoint, and MCP tool are gone. This feature
> now **rebuilds the backend** (Phase 0) and then **renders it** (Phase 1).
> See `STATUS.md` for the full history trace.

Completes the Site & Sun lens. The MVP shipped the lens with building
geometry, grey non-selectable shades, a north marker, and a quiet
"Set project location to see the sun path" hint. The frontend renderer
is a partial stub (it draws only the dashed analemmas, from the
always-`null` `/model_data` `sun_path` key). This feature stands the
sun-path service back up and completes the renderer (monthly arcs +
compass), fit to the model bounds.

Scope:

- **Backend sun-path service** — `project_location` builder + project-
  scoped `GET /projects/{id}/sun-path` endpoint + MCP tool, reading the
  existing `project_location` row → **Phase 0**.
- **Site & Sun 3D render** — the frontend consumer of Phase 0 → **Phase 1**.
- **Sun-path scrubber** (Q-VIEW-6; deferred roster item) → **Phase 2**,
  gated until Phase 1 ships and a time/season interaction has a real use
  case.

## Read order

1. `STATUS.md` — the build/delete history and where the code stands today.
2. `decisions.md` — D-SP-1 (decouple from the immutable `/model_data`
   artifact, accepted 2026-06-13) and the 2026-06-23 reconciliation note
   (backend lives in `project_location`, not "Climate").
3. `PRD.md` — behavior + the backend/frontend contracts.
4. `PLAN.md` — phase sequence and build order.
5. `phases/phase-00-backend-sun-path-service.md` — rebuild the backend.
6. `phases/phase-01-static-sun-path.md` — the frontend render.
7. `phases/phase-02-scrubber.md` — deferred sub-phase contract.

## Prerequisites

- **`project_location` feature** — data (`latitude`, `longitude`,
  `elevation_m`, `true_north_deg`, `time_zone`) + setter UI. **Met.**
  The Climate overhaul left these columns intact; the sun-path service
  reads them via `project_location.repository.get_location(...)`.
- **Model Viewer MVP** — Site & Sun lens stub keyed off `sunPath != null`
  and the geometry/`model.bounds` the render fits to. **Met.**

## Current decision

D-SP-1 (serving strategy) is **accepted** (Ed 2026-06-13): the sun path
is a separate, project-scoped, location-reactive endpoint — **not** baked
into the immutable `/model_data` artifact. The 2026-06-23 reconciliation
(`decisions.md`) records where that endpoint lives: `project_location`
(which owns the coordinates), **not** the app-wide Climate
reference-dataset feature. No open decisions block implementation.
