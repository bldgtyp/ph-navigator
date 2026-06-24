---
DATE: 2026-06-04
TIME: 12:41 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Assembly Canvas Phase 01 — single SVG substrate, mm viewBox, no render clamps
RELATED:
  - planning/archive/assembly-builder/PRD.md
  - planning/archive/assembly-builder/STATUS.md
  - frontend/src/features/envelope/components/AssemblyCanvas.tsx
  - frontend/src/features/envelope/components/AssemblySvgCanvas.tsx
  - frontend/src/features/envelope/components/AssemblyCanvasOverlay.tsx
---

# Phase 01 — SVG Canvas Substrate

## Goal

Replace the old HTML flexbox assembly canvas substrate with one
to-scale SVG whose geometry is expressed in millimeters. Keep existing
edit entry points available through temporary HTML overlay chrome.

## Implemented

- Added `AssemblySvgCanvas`, a single `<svg>` with `viewBox` in
  millimeters and one `<rect>` per segment.
- Added `buildAssemblyCanvasGeometry`, a one-pass shared geometry
  builder consumed by both SVG substrate and HTML overlay chrome.
- Removed the aspect-ratio-distorting canvas clamps:
  - `MIN_LAYER_HEIGHT_PX`
  - `MIN_SEGMENT_WIDTH_PX`
  - `MIN_LAYER_WIDTH_PERCENT`
- Kept `MIN_CANVAS_WIDTH_PX` as wrapper chrome only; it does not clamp
  layer height, segment width, or SVG geometry.
- Replaced continuous `0.1` zoom increments with discrete PRD steps:
  `[0.5, 0.75, 1.0, 1.5, 2.0, 3.0]`.
- Split current canvas composition into:
  - `AssemblyCanvas.tsx` — orchestration and geometry derivation.
  - `AssemblySvgCanvas.tsx` — pure SVG substrate.
  - `AssemblyCanvasOverlay.tsx` — temporary HTML chrome preserving
    current edit/copy/paste affordances until Phase 02.
- Removed obsolete flex-canvas CSS selectors.

## Verification

Focused frontend checks on 2026-06-04:

- `cd frontend && pnpm run format:check` — passed.
- `cd frontend && pnpm run lint` — passed.
- `cd frontend && pnpm run build` — passed.
- `cd frontend && pnpm test -- src/features/envelope/__tests__/EnvelopePage.test.tsx`
  — passed; Vitest currently runs the full frontend suite for this
  invocation (`94` files / `1072` tests).
- `make format` — passed.
- `make ci` — passed.

New test coverage:

- `EnvelopePage > assembly canvas renders segments in one to-scale svg without layer or segment clamps`
  asserts:
  - one SVG canvas is rendered;
  - `viewBox` is based on max layer width and total thickness in mm;
  - a 0.5 inch layer and a 3.5 inch layer render with a 1:7 height
    ratio;
  - a 0.5 inch segment and a 3.5 inch segment render with a 1:7 width
    ratio.

## Deferred To Phase 02

- CAD-style dimension column with inline thickness editing.
- Magenta hover `+` buttons matching the V1 screenshot.
- Final hover-highlight treatment and shadcn tooltips.
- Visual screenshot parity against `assets/v1-reference-to-scale.png`.
