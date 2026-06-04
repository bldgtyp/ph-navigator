---
DATE: 2026-05-27
TIME: 17:22 EDT
STATUS: Implemented on `codex/assembly-builder-ui-planning`; review and
        browser evidence remain.
AUTHOR: Codex
SCOPE: Assembly Builder UI/Layout parity, phase 14.
RELATED:
  - planning/archive/assembly-builder/PRD.md
  - planning/archive/assembly-builder/assets/_v1_basic_ui.png
  - planning/archive/assembly-builder/assets/_v1_add_layer.png
  - planning/archive/assembly-builder/assets/_v1_add_new_segment.png
  - frontend/src/features/envelope/components/AssemblyCanvas.tsx
  - frontend/src/features/envelope/components/MaterialLegend.tsx
  - frontend/src/features/envelope/canvas-constants.ts
  - frontend/src/features/envelope/envelope.css
---

# Phase 14 - To-Scale Canvas And Hover Controls

## Goal

Replace the scaffold canvas with a V1-equivalent visual builder: stacked
colored layers, side-by-side colored segments, orientation labels,
to-scale proportions, compact hover/focus controls, and a useful legend.

The result should look like the Assembly Builder, not a data table.

## In Scope

- Preserve canonical SI geometry:
  - layer thickness from `thickness_mm`;
  - segment width from `width_mm`;
  - one zoom scale shared across both axes.
- Render material colors from project-material `argb_color`, using the
  shared parser/fallback behavior.
- Render null-material segments as unfinished but editable.
- Add V1-style compact layer add controls near the thickness band.
- Add V1-style compact segment add controls on segment edges.
- Replace always-visible layer/segment text-link clusters with hover,
  focus, or contextual affordances.
- Keep keyboard-reachable controls for all hover-only actions.
- Keep copy/paste assignment mode visible without cluttering every
  segment.
- Keep the material legend tied to the active assembly, with swatches,
  names, and conductivity/missing-conductivity indicators.
- Verify IP/SI changes labels only, not geometry, zoom, scroll, or draft
  dirtiness.

## Out Of Scope

- Dialog content redesign. Phase 15 owns modal and material-picker UX.
- New copy/paste keyboard shortcuts. They remain deferred V1.1 unless
  separately promoted.
- Multi-row material division grids.
- Changing thermal calculation behavior.

## Implementation Notes

- Treat the V1 screenshots as interaction references:
  - `_v1_basic_ui.png`;
  - `_v1_add_layer.png`;
  - `_v1_add_new_segment.png`.
- Do not make text fit by shrinking font size with viewport width.
  Narrow segments should use stable fallback behavior: clipped label,
  tooltip, or legend-only identification.
- Use stable dimensions and `min/max` constraints so hover controls do
  not resize the drawing.
- The canvas may use CSS grid/flex or SVG if useful, but the data source
  remains the existing envelope read model.
- If the canvas becomes SVG-based, preserve semantic buttons or
  accessible overlays for keyboard and screen-reader access.

## Verification

- `git diff --check`
- `cd frontend && pnpm run format`
- `cd frontend && pnpm exec eslint src/features/envelope`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- Browser smoke:
  - inspect a one-layer null-material assembly;
  - inspect a multi-layer, multi-segment colored assembly;
  - hover/focus layer add controls;
  - hover/focus segment add controls;
  - edit a layer thickness from the canvas;
  - edit a segment from the canvas;
  - copy and paste a material assignment;
  - toggle IP/SI and confirm geometry does not jump.

## Exit Criteria

- The canvas uses the main view area and reads as a to-scale assembly
  drawing.
- Layer and segment controls are quiet by default and discoverable on
  hover/focus.
- Material colors and legend match the active assembly.
- The current screenshot's table-like canvas state is gone.

## Risks

- Hover-only controls can become inaccessible. Build the keyboard path
  at the same time as hover visuals.
- Very thin layers and narrow segments can create overlap. Define
  minimum display dimensions and fallback labels in the same pass.

## Implementation Notes - 2026-05-27

- Kept the canvas DOM/CSS-based rather than SVG-based so existing
  semantic buttons and dialog command wiring stay intact.
- Added outside/inside orientation labels, colored material segments,
  clipped stable segment text, and contextual hover/focus action trays.
- Kept hover/focus controls mounted for keyboard reachability, with
  contextual aria labels for layer and segment commands.
- Scoped the legend to active-assembly materials and added lambda /
  missing-lambda status.
- Added regression coverage for active-material legend scoping.
- Local browser smoke was attempted against the Vite dev server on
  `http://localhost:5174`, but the route could not load project data
  because the backend/API was not running in this worktree. Phase 16
  still owns browser evidence.
