---
DATE: 2026-07-01
TIME: 16:31
STATUS: Implemented on branch `feature/model-viewer-sun-study`
  (2026-07-01) — phases 01–05 complete, phase 06 verification/closeout
  in progress. Includes the folded-in ground-shadows baseline fix
  (D-12), shipped in phase 01.
AUTHOR: Claude (for Ed)
SCOPE: Router for the model-viewer sun-study feature (date/time
  scrubbers + real-time sun shadows in the Site & Sun lens).
RELATED:
  - PRD.md, STATUS.md (this folder)
  - context/user-stories/40-model-viewer.md (Q-VIEW-6 — un-deferred by
    this feature)
---

# Model Viewer — Sun Study

Add a "Sun study" mode to the Site & Sun lens: a date-of-year scrubber
and a time-of-day scrubber move a sun marker along the existing
sunpath dome and re-aim the scene's key light so the model casts
real-time shadows on itself and a ground plane. Solar positions come
from a backend-computed hourly grid (all calculation stays server-side);
controls follow progressive disclosure (one collapsed pill → full bar);
rendering stays inside the viewer's draw-call/perf budget.

## Read order

1. `PRD.md` — product/behavior contract.
2. `STATUS.md` — current state and next step.
3. `PLAN.md` — implementation sequence (phase table + gates).
4. `phases/phase-01…06` — per-phase implementation plans.

## Scope boundaries

- Site & Sun lens only for sun-study behavior; the folded-in
  ground-shadow baseline fix (PRD D-12, imported from
  `../model-viewer-ground-shadows/`) applies across all lenses.
- Qualitative shading visualization — no radiation/daylighting metrics.
- Playback/animation deferred — manual scrub only (PRD §9).
