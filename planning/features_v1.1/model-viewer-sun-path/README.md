---
DATE: 2026-06-13
TIME: -
STATUS: Active — ready to implement. D-SP-1 accepted (Ed 2026-06-13);
  no open decisions.
AUTHOR: Claude (for Ed)
SCOPE: Router for the Model Viewer Site & Sun sun-path feature —
  wiring project-location data into a rendered annual sun path, plus
  the deferred time/season scrubber.
RELATED:
  - PRD.md
  - decisions.md
  - PLAN.md
  - phases/phase-01-static-sun-path.md
  - phases/phase-02-scrubber.md
  - planning/archive/model-viewer/ (completed MVP — source of truth)
  - planning/archive/model-viewer/decisions.md D-07
  - planning/archive/project-location/PRD.md §10 (consumer seam)
  - planning/features_v1.1/model-viewer-post-mvp/ (umbrella router)
---

# Model Viewer — Sun Path

Completes the Site & Sun lens. The MVP shipped the lens with building
geometry, grey non-selectable shades, a north marker, and a quiet
"Set project location to see the sun path" hint. The backend
`sun_path` wire key is permanently `null` and the frontend renderer is
a partial stub. This feature populates and renders the annual sun path
from the project's stored location.

It folds in two deferred post-MVP candidates:

- **Sun-path wiring** (deferred roster item; D-07 / project-location
  seam) → **Phase 1**.
- **Sun-path scrubber** (Q-VIEW-6; deferred roster item) → **Phase 2**,
  which is itself gated until Phase 1 ships and a time/season
  interaction has a real use case.

## Read order

1. `decisions.md` — the settled serving decision (D-SP-1: decouple the
   sun path from the immutable `/model_data` artifact, accepted
   2026-06-13) plus inherited constraints.
2. `PRD.md` — behavior contract.
3. `PLAN.md` — phase sequence and build order.
4. `phases/phase-01-static-sun-path.md` — the implementable handoff.
5. `phases/phase-02-scrubber.md` — deferred sub-phase contract.

## Prerequisites (all met)

- Model Viewer MVP Phases 2 + 6 merged (extraction owns
  ladybug/honeybee; Site & Sun renderer stub keyed off
  `sunPath != null`).
- `project-location` feature merged and archived
  (`planning/archive/project-location/`): location data
  (lat/long/true-north/time-zone) is available via REST, MCP, and the
  in-process `features/project_location/repository.py`.

## Current decision

Ready to schedule. D-SP-1 (serving strategy) is **accepted** (Ed
2026-06-13): sun path is served from a separate, project-scoped,
location-reactive endpoint + store; the `/model_data` artifact stays
immutable. The setter UI already shipped with `project_location`
(`ProjectLocationSettingsSection.tsx`) — this feature only consumes the
location data. No open decisions; Phase 1 is implementable as written.
