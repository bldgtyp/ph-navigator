---
DATE: 2026-06-13
TIME: -
STATUS: Active — REALIGNED 2026-06-13. Now FRONTEND-ONLY; depends on
  Climate Phase 1 (which owns the sun-path backend/endpoint). D-SP-1
  accepted; no open decisions.
AUTHOR: Claude (for Ed)
SCOPE: The Model Viewer Site & Sun 3D render — consume the Climate
  sun-path endpoint and draw the annual sun path over the building
  geometry. Plus the deferred time/season scrubber.
RELATED:
  - PRD.md
  - decisions.md
  - PLAN.md
  - phases/phase-01-static-sun-path.md
  - phases/phase-02-scrubber.md
  - planning/archive/climate/ (OWNS the sun-path service — build first)
  - planning/archive/model-viewer/ (completed MVP — source of truth)
  - planning/archive/model-viewer/decisions.md D-07
  - planning/features_v1.1/model-viewer-post-mvp/ (umbrella router)
---

# Model Viewer — Sun Path (3D render)

> **Realigned 2026-06-13.** The sun-path *backend* (builder + endpoint)
> moved to the **Climate** feature (`planning/archive/climate/`
> Phase 1), its proper home, because the sun path is climate-derived and
> has multiple consumers (this 3D render + the Climate tab). This
> feature is now **frontend-only**: it consumes the Climate
> `GET /projects/{id}/sun-path` endpoint and renders the diagram over
> the building geometry in the Site & Sun lens. **It depends on Climate
> Phase 1 shipping first.**

Completes the Site & Sun lens. The MVP shipped the lens with building
geometry, grey non-selectable shades, a north marker, and a quiet
"Set project location to see the sun path" hint. The frontend renderer
is a partial stub (it only draws the dashed analemmas, from the
always-null `/model_data` `sun_path` key). This feature points the lens
at the Climate sun-path endpoint and completes the renderer (monthly
arcs + compass), fit to the model bounds.

Scope:

- **Site & Sun 3D render** (the frontend consumer of Climate Phase 1)
  → **Phase 1**.
- **Sun-path scrubber** (Q-VIEW-6; deferred roster item) → **Phase 2**,
  gated until Phase 1 ships and a time/season interaction has a real
  use case.

## Read order

1. `decisions.md` — the settled serving decision (D-SP-1: decouple the
   sun path from the immutable `/model_data` artifact, accepted
   2026-06-13) plus inherited constraints.
2. `PRD.md` — behavior contract.
3. `PLAN.md` — phase sequence and build order.
4. `phases/phase-01-static-sun-path.md` — the implementable handoff.
5. `phases/phase-02-scrubber.md` — deferred sub-phase contract.

## Prerequisites

- **Climate Phase 1 (`planning/archive/climate/`) merged** — it owns
  the `GET /projects/{id}/sun-path` endpoint this feature consumes.
  **This is the gating prerequisite.**
- Model Viewer MVP Phases 2 + 6 merged (Site & Sun renderer stub keyed
  off `sunPath != null`; the geometry/bounds this render fits to).

## Current decision

Frontend-only, gated on Climate Phase 1. D-SP-1 (serving strategy) is
**accepted** (Ed 2026-06-13): the sun path is a separate, project-scoped,
location-reactive endpoint — now owned by Climate. This feature consumes
it and renders over geometry. The setter UI already shipped with
`project_location`. No open decisions for this feature; it is
implementable once Climate Phase 1 lands.
