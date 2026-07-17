---
DATE: 2026-07-17
TIME: afternoon ET
STATUS: Not started
AUTHOR: Codex
SCOPE: Apertures, envelope, shared canvas/dimension chrome, element sidebar,
  and attachment typography
DEPENDS_ON: Phase 3
RELATED:
  - `../PRD.md`
  - `../TYPOGRAPHY-CONTRACT.md`
---

# Phase 4 — Technical workspaces

## Goal

Consolidate the drawing- and editor-heavy surfaces while preserving technical
annotation hierarchy and canvas geometry.

## Primary owners

- `frontend/src/features/apertures/apertures.css`
- `frontend/src/features/envelope/envelope.css`
- `frontend/src/shared/ui/canvas/*.css`
- `frontend/src/shared/ui/dimensions/DimensionChrome.css`
- `frontend/src/shared/ui/element-sidebar/element-sidebar.css`
- `frontend/src/shared/ui/attachments/attachments.css`

## Build

1. Apply D3 through the canvas-annotation role/token. Keep 10px only if the
   accepted decision requires it; no literal allowlist.
2. Apply D4 to the aperture editor-hero heading.
3. Normalize aperture cards, U-value chips, operation controls, dimension
   labels, sidebars, assembly editors, layer controls, attachment chrome, and
   technical tooltips.
4. Replace 550/650 weights and every owner-local tracking value with approved
   roles.
5. Reuse shared button, heading, badge, form, and table roles wherever the
   technical surface is ordinary UI; reserve canvas roles for actual drawing
   annotation.
6. Remove resolved owner fingerprints from the debt baseline.

## Verification

- Focused computed audit: apertures and envelope, including representative
  editor/expanded states absent from the original sweep.
- Screenshots: aperture card/editor, canvas dimensions at normal and zoomed
  views, operation controls, envelope assembly builder, element sidebar, and
  attachments.
- Inspect text clipping, canvas-label position, hit-target geometry, chip
  height, button alignment, and technical-unit legibility.
- Existing aperture/envelope component tests pass where class contracts change.
- `make frontend-dev-check` during iteration; `make format` and `make ci` at
  phase closeout.

## Done when

Technical workspace owners contain no unapproved typography debt and canvas
exceptions are named, documented, and covered by a rendered state.
