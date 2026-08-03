---
DATE: 2026-08-03
TIME: 09:16 EDT
STATUS: Deferred — scoped, not started
AUTHOR: Claude with Ed May
SCOPE: Bring the Apertures catalog-drift UX up to the pattern established for
  Envelope materials on 2026-08-03 — collapsed-row flag, one consolidated
  count-bearing action, honest banner scope, and the shared modal contract.
RELATED:
  - ./PRD.md
  - ./STATUS.md
  - ../../../context/technical-requirements/envelope-catalog-drift.md
  - ../../../context/ui/pages/apertures-tab.md
  - ../../../context/DESIGN_SYSTEM.md
---

# Aperture catalog-drift UX parity

Planning router for making the Apertures tab's catalog-drift affordances match
the ones shipped for Envelope materials.

## Why this exists

The materials drift rework (2026-08-03) fixed four UX problems: a banner whose
count disagreed with what its link opened, drift being invisible until you
expanded each row, a badge and its action separated across the row's full
width, and a dialog that re-prompted after a successful apply.

Apertures has an independent implementation of the same feature and carries
**most of the same problems**, plus one the materials side never had: its
"Review all" modal is hand-rolled rather than built on `ModalDialog` +
`DialogActions`, so it did not inherit the shared modal-chrome fix.

Nothing here is a new capability. It is one feature wearing two different
faces, and the aperture face is now the worse of the two.

## Read order

1. `PRD.md` — the current-state audit and the target behavior, item by item.
2. `STATUS.md` — state, next step, verification recipe.

## Not in scope

- The aperture drift **backend** contract (`features/aperture_drift/`) and its
  per-use-site entry model. The entry shape is fine; this is presentation.
- Merging the two drift subsystems into one. Materials drift is per project
  material; aperture drift is per (element, target) use site. They stay
  separate; only the affordances converge.
