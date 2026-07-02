---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Aperture Builder workflow improvements for copy/paste action coupling
  and horizontal flip behavior.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./decisions.md
  - planning/archive/dated/2026-06-05/apertures/README.md
---

# Aperture Builder Workflow

## Scope

Improve the Aperture Builder editing workflow:

- After selecting the picker/copy-attributes tool and then selecting a valid
  aperture element, immediately transition to paste-ready mode.
- Reflect paste-ready state in the toolbar icon/highlight.
- Add a `Flip left/right` command similar to Envelope Builder.
- Make `Flip left/right` mirror element layout and frame assignments; it is not
  the same as switching `View from Exterior` / `View from Interior`.

## Read Order

1. `STATUS.md` - current state and next action.
2. `PRD.md` - behavior contract and acceptance criteria.
3. `PLAN.md` - split implementation phases.
4. `decisions.md` - accepted remapping rules for flip implementation.

## Classification

Archived from `planning/features` after the workflow behavior shipped.
