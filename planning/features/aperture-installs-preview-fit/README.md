---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: In review — implemented on branch
AUTHOR: Ed May / Codex
SCOPE: Aperture SVG fit behavior inside the Installs modal
RELATED:
  - planning/features/aperture-installs-preview-fit/PRD.md
  - planning/features/aperture-installs-preview-fit/STATUS.md
  - planning/2026-08-19-ui-batch.md
---

# Aperture Installs Preview Fit

The Installs modal currently fits its key-view SVG to a hard-coded 360 px width.
Tall apertures therefore grow beyond the available modal height and are clipped
or require scrolling before the whole assignment can be understood.

This packet replaces width-only sizing with true contain-fit sizing while
keeping the geometry-driven install-edge overlay exactly aligned.

## Read order

1. `PRD.md` — fit and interaction contract.
2. `STATUS.md` — next step and verification ledger.

## Current-code anchors

- `frontend/src/features/apertures/components/InstallsModal.tsx`
- `frontend/src/features/apertures/components/ApertureSvgCanvas.tsx`
- `frontend/src/features/apertures/components/ApertureCanvasContainer.tsx`
- `frontend/src/features/apertures/apertures.css` (`#installs-modal` and
  `.installs-modal__key-view`)
- `frontend/src/features/apertures/install-overlay.ts`

The fixed `KEY_VIEW_WIDTH_PX` calculation is replaced by a measured contain-fit
viewport. `ApertureSvgCanvas` keeps its builder-default `MIN_CANVAS_WIDTH_PX`
floor and exposes exact sizing only for the preview; the SVG and every overlay
band consume one shared zoom and padded origin.
