---
DATE: 2026-06-13
TIME: -
STATUS: Active — roster triaged; buildable items broken into feature
  folders 2026-06-13.
AUTHOR: Claude (for Ed)
SCOPE: Status and reopen gates for Model Viewer post-MVP work.
RELATED:
  - README.md
  - PRD.md
  - planning/features_v1.1/model-viewer-sun-path/
  - planning/features_v1.1/model-viewer-legend-filter/
  - planning/features_v1.1/model-viewer-clipping-planes/
  - planning/archive/model-viewer/STATUS.md
  - context/user-stories/40-model-viewer.md
---

# Model Viewer Post-MVP - Status

## Status

Roster triaged 2026-06-13. The buildable candidates now have their own
feature folders with detailed phased plans (Tier 1 + Tier 2 below).
None of these block the completed Model Viewer MVP archive. Reopen only
on Ed's promotion.

## Deferred Roster

| Item | Tier | Plan | Reopen gate |
|---|---|---|---|
| Sun-path 3D render in Site & Sun | 1 (frontend) | [`model-viewer-sun-path/`](../model-viewer-sun-path/) Phase 1 | **Climate Phase 1 merged** (`planning/features/climate/`) — it owns the sun-path endpoint (realigned 2026-06-13). D-SP-1 accepted. Then this is a frontend render. |
| Sun-path scrubber | 1 (gated sub-phase) | [`model-viewer-sun-path/`](../model-viewer-sun-path/) Phase 2 | Phase 1 merged **and** a named time/season review need (Q-VIEW-6). |
| NEW-VIEW-2 legend-as-filter | 1 (ready) | [`model-viewer-legend-filter/`](../model-viewer-legend-filter/) | None — ready. Ed-flagged near-priority. |
| Section / clipping planes | 2 (gated) | [`model-viewer-clipping-planes/`](../model-viewer-clipping-planes/) | A named sectioned-inspection workflow (Q-VIEW-8). |
| NEW-VIEW-1 HBJSON ↔ document cross-check | 3 (not phased) | `PRD.md` stub | Plan with the Rooms/equipment QA/QC family (NEW-ROOMS-1) so divergence rules can be defined against builder tables. |
| Comments / annotations | 3 (not phased) | `PRD.md` stub | App has a shared comment/presence model — not a Model Viewer-only island (D-I7). |
| John test / non-technical product validation | 3 (not code) | `PRD.md` stub | Coordinate outside a coding-agent session; record the outcome here or in the archived MVP status if it changes the product contract. |

## Key decision settled 2026-06-13

**D-SP-1 (sun path serving strategy) — accepted (Ed 2026-06-13).** The
project-location seam (`planning/archive/project-location/PRD.md` §10)
assumed populating the `/model_data` `sun_path` key inside extraction.
But `/model_data` is a D-15 immutable, upload-time, forever-cached
artifact, while project location is a project-level variable edited
independently and usually *after* upload — so a baked-in sun path would
never update. Resolved: the sun path is **decoupled** into a separate,
project-scoped, location-reactive endpoint + store; the `/model_data`
artifact stays immutable with `sun_path` null
(`model-viewer-sun-path/decisions.md`).

## Notes

- Full `make e2e` was red during MVP closeout because of unrelated
  non-model-viewer specs. The focused model-viewer Playwright suite
  passed. Those failures belong to their owning features; they are not
  deferred Model Viewer work.
- The completed MVP archive at `planning/archive/model-viewer/` is the
  implementation source of truth for everything these features build
  on.
