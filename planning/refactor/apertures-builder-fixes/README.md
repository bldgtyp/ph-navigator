---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active — captured, not scheduled
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Three self-contained fixes to the Aperture Builder canvas (Apertures /
  Apertures): operable-direction arrow restyle, U-Value chip layout bug, and
  zoom-to-fit on first render.
RELATED:
  - frontend/src/features/apertures/operation-symbols.ts (item 1 — arrow geometry)
  - frontend/src/features/apertures/components/OperationSymbols.tsx (item 1)
  - frontend/src/features/apertures/components/UValueChip.tsx (item 2)
  - frontend/src/features/apertures/components/ApertureCanvasContainer.tsx (items 2, 3)
  - frontend/src/features/apertures/apertures.css (items 1, 2)
  - frontend/src/features/apertures/components/ZoomCluster.tsx (item 3)
  - frontend/src/features/apertures/components/ApertureSvgCanvas.tsx (item 3)
---

# Aperture Builder canvas fixes

Three unrelated but small fixes in the same screen. Ship together or à la carte.

## Item 1 — Operable-direction arrow restyle (tweak)

The arrow that marks an operable sash's swing/slide direction looks bad:

- The **arrowhead is too big and too wide**.
- The window-element **name pill ("Unnamed") overlaps/covers the arrow**.

**Desired:** slimmer, smaller arrowhead; reposition the arrow (e.g. shift up or
down) so the name label no longer covers it. Geometry lives in
`operation-symbols.ts`; rendering in `OperationSymbols.tsx`.

**Open Q:** move the arrow, move the name pill, or offset whichever collides?
Start by nudging the arrow clear of the label's vertical center.

## Item 2 — U-Value chip layout bug (bug)

In the aperture-type header, the "U-Value 0.19 BTU/(hr·ft²·°F)" chip renders
vertically centered on the horizontal divider line and **partially covers the
dimension label** ("20' × 8'") beneath it. Looks like wrong container nesting or
bad positioning CSS.

**Desired:** chip sits in its own row with proper spacing — not overlapping the
divider or the dimension text. Check `UValueChip.tsx` placement within
`ApertureCanvasContainer.tsx` / the header block, and `apertures.css`.

## Item 3 — Zoom-to-fit on first render (tweak)

Zoom level is persisted across page changes (keep this). But on **first render**,
before the user has ever set a zoom explicitly, the canvas doesn't frame the unit
nicely.

**Desired:** on first landing, auto-calibrate zoom to **fit the entire
window-unit** (the first aperture in the list) in the viewport. After the user
sets a zoom explicitly once, respect/persist that value as today. So
zoom-to-fit is the default *only* until the first explicit user zoom.

**Open Q:** track an "hasUserZoomed" flag alongside the persisted zoom so we know
when to stop auto-fitting. Fit math likely belongs near `ApertureSvgCanvas` /
`ZoomCluster`; persistence in `ApertureCanvasContainer`.

## Acceptance

- Arrow reads cleanly at normal zoom; name label never covers it.
- U-Value chip no longer touches the divider or the dimension text.
- Landing on Apertures with no saved zoom frames the first unit fully; once you
  zoom manually, that zoom sticks across page changes.
