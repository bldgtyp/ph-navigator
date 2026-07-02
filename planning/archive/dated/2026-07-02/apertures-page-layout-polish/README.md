---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Apertures page layout polish for the aperture-type sidebar, SVG preview,
  attribute cards, and near-viewport dropdown placement.
RELATED:
  - ./PRD.md
  - ./STATUS.md
  - ./PLAN.md
---

# Apertures Page Layout Polish

## Scope

Fix the Apertures / Apertures page layout issues collected during app testing:

- Keep selected aperture attribute cards directly under the SVG preview.
- Make the long `Aperture Types` sidebar scroll independently instead of pushing
  the main card content down the page.
- Center collapsed-sidebar action buttons inside the collapsed rail.
- Ensure attribute-card dropdowns render upward when there is not enough viewport
  space below the control.

## Read Order

1. `PRD.md` - behavior contract and acceptance criteria.
2. `PLAN.md` - implementation phases and verification.
3. `STATUS.md` - current state and next action.

## Classification

`planning/refactor` because this is a layout/interaction cleanup for an existing
Apertures surface, not a new product capability.
