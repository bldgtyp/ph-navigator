---
DATE: 2026-06-12
TIME: 17:19 EDT
STATUS: Active — planned
AUTHOR: Claude (for Ed)
SCOPE: Status ledger for the Project Location feature.
RELATED:
  - planning/features/project-location/README.md
  - planning/features/project-location/PRD.md
  - planning/features/project-location/PLAN.md
  - planning/features/project-location/decisions.md
---

# Project Location — Status

`Active — planned.` Requirements stub (2026-06-12) expanded into a
full PRD + 3-phase plan. The two open forks are resolved
(decisions.md): **dedicated `project_location` table + module**
(D-PL-1) and **sun-path wiring deferred to model-viewer** (D-PL-2). No
code yet.

## Phases

| Phase | Title | State |
|-------|-------|-------|
| 1 | Location backbone (BE: table + REST + MCP) | Planned — ready for handoff, no blockers |
| 2 | Location UI (FE: Project Settings section) | Planned — depends on Phase 1 |
| 3 | EPW linkage (BE+FE) | Planned — depends on Phases 1–2 |

## Next step

Implement **Phase 1** (`phases/phase-01-location-backbone.md`). It is
the critical path, has no blockers, and on completion satisfies the
model-viewer sun-path **data** dependency (lat/long/north readable via
REST + MCP).

## Blockers

None for Phases 1–3.

## Deferred / external

The model-viewer **sun-path wiring** (populating the `sun_path` wire
key via `Sunpath.from_location`) is owned by model-viewer, not this
plan (decisions.md D-PL-2). It is schedulable once model-viewer
Phase 2 (extraction + ladybug dep) and Phase 6 (renderer stub) are
merged; the seam is specified in PRD §10. Until then the Site & Sun
lens shows the building + shades + a "Set project location" hint, and
this feature's Phase 2 UI is where that location is set.
