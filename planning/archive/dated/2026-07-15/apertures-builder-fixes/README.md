---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: ✅ Complete — implemented + verified 2026-07-15 (commit ab00c89f, branch refactor/apertures-builder-fixes)
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

## Outcome — 2026-07-15 (commit ab00c89f)

All three items shipped on branch `refactor/apertures-builder-fixes`.

- **Item 1 — arrow.** `operation-symbols.ts` `slideArrow`: split the single
  `ARROW_HEAD_FRACTION` into a length (0.13) + half-width (0.05) so the head is
  a slim point instead of a wider-than-long wedge; added
  `ARROW_LABEL_CLEARANCE_FRACTION` (0.2) that nudges the arrow perpendicular to
  its axis (horizontal arrows drop below center, vertical arrows step beside it)
  to clear the centered name pill. Offset is a fraction of the *glazing*
  dimension so the whole arrow stays inside the rect.
- **Item 2 — chip.** `apertures.css` `.apertures-page__header` gets
  `flex-shrink: 0`; as a column-flex child it was being compressed below its
  min-height, spilling the summary row (U-Value chip) past the divider onto the
  dimension caption.
- **Item 3 — fit.** `ApertureCanvasContainer.tsx` `fitZoom` now frames the whole
  unit — largest zoom where both width and height fit inside the scroll viewport
  minus its edge padding, clamped to `[ZOOM_MIN, ZOOM_MAX]` — replacing the
  width-only, discrete-step snap that clipped tall units. `hasCanvasZoom`
  (already present) still stops the auto-fit after the first explicit user zoom.
  Orphaned `snapZoomToStep` removed; Fit control relabeled "Fit canvas to view".

**Verification.** `make ci` green (2165 FE + 1373 BE). Browser-verified on the
local `AGENT-BROWSER` fixture: chip↔caption gap restored (11px), slide arrow
sits clear below the name pill, and a short-viewport Fit framed the unit with no
vertical/horizontal overflow (height-aware).

**Known residual (deferred, low priority).** The arrow's label-clearance offset
is a fraction of the glazing dimension, so at `ZOOM_MIN` on a small glazing the
rendered clearance can shrink below the fixed-px name-pill footprint and the two
can still partially overlap. A fixed-px clearance was rejected because it
overflows the arrow *outside* small glazings at low zoom; a fuller fix would
reposition the pill itself. Strictly better than the prior always-centered
arrow; acceptable for now.
