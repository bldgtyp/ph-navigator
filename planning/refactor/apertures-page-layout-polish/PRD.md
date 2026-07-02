---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Product behavior contract for Apertures page layout polish.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./STATUS.md
---

# PRD - Apertures Page Layout Polish

## Problem

On the Apertures / Apertures page, a long `Aperture Types` sidebar changes the
main page height and pushes the selected element attribute card far below the SVG
preview. The drawing and its editable attributes become visually disconnected.
When the sidebar is collapsed, its icon buttons are not centered in the narrow
rail. When an attribute card sits near the bottom of the viewport, select
dropdowns can flow off-screen and become inaccessible.

## Desired Behavior

- The SVG preview and selected attribute cards should read as one working area.
- The aperture-type list should be height-bounded and vertically scrollable
  inside the sidebar.
- The sidebar height should be governed by the SVG + card working area, not by
  the full length of the aperture-type list.
- Collapsed sidebar controls should be horizontally centered in the collapsed
  rail with consistent spacing.
- Dropdowns in attribute cards should use viewport-aware placement and render
  above the triggering control when there is insufficient room below.

## Acceptance Criteria

- With a project containing many aperture types, the selected attribute card
  remains directly below the SVG without scrolling past a long sidebar list.
- The `Aperture Types` list scrolls inside its sidebar when it exceeds the
  bounded page working area.
- The collapsed-sidebar buttons are centered in the rail.
- Opening a frame/glazing/operation dropdown near the bottom of the viewport
  keeps the full menu reachable on-screen by placing it above the control.
- `make frontend-dev-check` passes.
- Live browser smoke verifies the Apertures / Apertures route at desktop width
  using the repo local baseline from `planning/features/.instructions.md`.

## Non-Goals

- No changes to aperture geometry, frame compatibility, or builder commands.
- No redesign of the global project shell.
- No new persistence behavior.

## Investigation Notes

- Determine whether the attribute-card dropdowns use the shared select/autocomplete
  primitive or a local aperture-specific component.
- Inspect the layout container that currently lets the sidebar list drive the
  main content height.

