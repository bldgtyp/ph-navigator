---
DATE: 2026-08-19
TIME: 19:35 EDT
STATUS: Complete — implemented and verified on branch
AUTHOR: Ed May / Codex
SCOPE: Product contract for Installs-modal aperture preview fitting
RELATED:
  - planning/archive/dated/2026-08-19/aperture-installs-preview-fit/README.md
  - planning/archive/dated/2026-08-19/aperture-installs-preview-fit/STATUS.md
---

# PRD — Aperture Installs Preview Fit

## Problem

`InstallsModal` computes zoom from a fixed width only:

`KEY_VIEW_WIDTH_PX / apertureWidth`.

That guarantees a nominal width but ignores available height. The shared
`ApertureSvgCanvas` also enforces a 360 px minimum width, so an attempted smaller
fit can desynchronize the in-flow SVG and the absolutely positioned install
overlay.

## Required behavior

- The complete aperture, including every frame/glazing/void/operation symbol
  and install overlay band, is visible in the key-view region at modal open.
- Preserve aspect ratio and geometry proportions.
- Maintain at least 16 px visual padding on every side of the drawing.
- Compute zoom as the smaller of the available-width and available-height fit.
- Recompute after modal/viewport resize through measured container geometry;
  do not depend on a window-size guess.
- The SVG and install overlay consume the exact same computed zoom and origin.
- Very small apertures may scale up to at most the existing `ZOOM_MAX = 3`;
  downscaling has no `ZOOM_MIN` floor because the complete drawing must fit.
- Very tall and very wide apertures scale down rather than clip.
- Painting, hover, focus, tooltip, mulled-edge, and Apply-to-all hit targets
  remain aligned with the drawn edge.
- The legend remains usable and independently scrollable when the install-type
  library is long.
- At narrow viewports the existing two-column layout may stack, but the drawing
  must still contain-fit its new key-view region.

## Implementation constraint

Create a `.installs-modal__preview-slot` that owns the measurable viewport. The
left modal column is a grid with `minmax(0, 1fr)` for that slot and `auto` for
the paint bar; the slot has `min-width: 0`, `min-height: 0`, and excludes the
paint bar and inter-row gap from its measured height. On the narrow stacked
layout it receives an explicit viewport-safe minimum/maximum block size rather
than sizing itself from the drawing.

The slot supplies 16 px CSS padding. The inner drawing plane is its content box:
fit against that width/height, place both SVG and overlay at inner origin
`(0, 0)`, and offset both together by the outer padding. Overlay coordinates
remain raw shared `pxFromMm` coordinates; padding is never added to individual
bands.

Extract/reuse the contain-fit math already present in
`ApertureCanvasContainer` rather than create a second formula. Add an explicit
fit sizing mode/override to `ApertureSvgCanvas`; do not remove the builder's
`MIN_CANVAS_WIDTH_PX` behavior globally. A `ResizeObserver` recomputes from the
slot. Before the first non-zero measurement, keep the preview hidden and do not
commit a zero-derived zoom; later zero-size observations retain the last valid
fit until a non-zero size returns.

## Acceptance matrix

- Portrait aperture (height much greater than width).
- Landscape aperture (width much greater than height).
- Multi-row/multi-column aperture with operation symbols.
- Void and missing-frame cases.
- Mulled edges and every perimeter overlay side.
- Desktop modal, resized larger/smaller, and narrow stacked layout.

For every case: bounding-box assertions show padding on all four sides, no
overflow, and overlay rectangles remain coincident with their SVG regions.

## Non-goals

- Changing the main Apertures builder zoom or its persisted/session behavior.
- Changing install assignment semantics.
- Redesigning the Installs legend or staged-save flow.
