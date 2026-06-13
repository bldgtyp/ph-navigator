---
DATE: 2026-06-13
TIME: -
STATUS: Deferred
AUTHOR: Codex
SCOPE: Status and reopen gates for Model Viewer post-MVP work.
RELATED:
  - README.md
  - PRD.md
  - planning/archive/model-viewer/STATUS.md
  - context/user-stories/40-model-viewer.md
---

# Model Viewer Post-MVP - Status

## Status

Deferred to v1.1+ or product validation. Do not treat these as
blockers for the completed Model Viewer MVP archive.

## Deferred Roster

| Item | Source | Reopen gate |
|---|---|---|
| Sun-path wiring in Site & Sun | D-07 / project-location seam | Reopen when Ed wants the annual sun-path overlay; location data exists via archived `project-location`, but Model Viewer still needs the frontend/backend wiring that populates `sun_path`. |
| NEW-VIEW-2 legend-as-filter | US-Viewer Q-VIEW-7; near-priority post-MVP | Reopen when review workflows need isolating visible geometry by legend row/swatch. |
| NEW-VIEW-1 HBJSON <-> project document cross-check | US-Viewer Q-VIEW-9 | Reopen with the Rooms/equipment QA/QC family so divergence rules can be defined against builder tables. |
| Section / clipping planes | US-Viewer Q-VIEW-8 | Reopen when wall-section or interior-inspection workflows need plane placement in the 3D scene. |
| Sun-path scrubber | US-Viewer Q-VIEW-6 | Reopen after static sun-path rendering exists and time/season interaction has a clear use case. |
| Comments / annotations | Decisions D-I7 | Reopen when the app has a broader comment/presence model, not as a Model Viewer-only island. |
| John test / non-technical product validation | Model Viewer PRD §8.4 | Coordinate outside coding-agent implementation. Record outcome in this folder or the archived MVP status if it materially changes the product contract. |

## Notes

- Full `make e2e` was red during MVP closeout because of unrelated
  non-model-viewer specs. The focused model-viewer Playwright suite
  passed. Track those unrelated e2e failures with their owning
  features; they are not deferred Model Viewer work.
- The completed MVP archive at `planning/archive/model-viewer/` is the
  implementation source of truth.
