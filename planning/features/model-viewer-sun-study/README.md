---
DATE: 2026-07-01
TIME: 16:31
STATUS: PRD reviewed by Ed 2026-07-01; ready for implementation
  planning. Includes the folded-in ground-shadows baseline fix (D-12).
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

1. `PRD.md` — product/behavior contract (current focus).
2. `STATUS.md` — current state and next step.
3. `phases/` — implementation phase plans (none authored yet).

## Scope boundaries

- Site & Sun lens only for sun-study behavior; the folded-in
  ground-shadow baseline fix (PRD D-12, imported from
  `../model-viewer-ground-shadows/`) applies across all lenses.
- Qualitative shading visualization — no radiation/daylighting metrics.
- Playback/animation deferred — manual scrub only (PRD §9).
