---
DATE: 2026-05-27
TIME: 17:22 EDT
STATUS: Implemented on `codex/assembly-builder-ui-planning`; review and
        browser evidence remain.
AUTHOR: Codex
SCOPE: Assembly Builder UI/Layout parity, phase 13.
RELATED:
  - planning/archive/assembly-builder/PRD.md
  - planning/archive/assembly-builder/STATUS.md
  - planning/archive/assembly-builder/assets/_v1_basic_ui.png
  - planning/archive/assembly-builder/assets/_v1_add_layer.png
  - planning/archive/assembly-builder/assets/_v1_add_new_segment.png
  - frontend/src/features/envelope/routes/EnvelopePage.tsx
  - frontend/src/features/envelope/components/EnvelopeSidebar.tsx
  - frontend/src/features/envelope/components/AssemblyHeader.tsx
  - frontend/src/features/envelope/envelope.css
---

# Phase 13 - Three-Pane Assemblies Shell

## Goal

Reshape the Assemblies tab from the current functional scaffold into the
V1-derived three-pane workspace:

1. collapsible assembly sidebar/drawer;
2. top assembly bar with active assembly picker, metrics, and compact
   tools;
3. main assembly view reserved for the to-scale canvas and legend.

This phase is layout first. It should preserve existing command behavior
while moving controls into their durable homes.

## Current Problem

The current UI is functionally wired but reads as a generic page with a
small table-like drawing block. The canvas does not own the main view,
many tool controls are stretched across the page as text buttons, and
the sidebar/top-bar/main-view relationship does not yet match the V1
mental model.

## In Scope

- Evolve the existing `EnvelopeSidebar`, `AssemblyHeader`,
  `AssemblyCanvas`, and `MaterialLegend` composition into durable
  boundaries for:
  - `AssemblyWorkspace`;
  - `AssemblySidebar` or `AssemblyDrawer`;
  - `AssemblyTopBar`;
  - `AssemblyMainView`.
- Keep both active-assembly switching paths:
  - sidebar/drawer row selection;
  - top-bar select/dropdown.
- Preserve sidebar/drawer collapse/expand state without resetting active
  assembly, canvas zoom, or scroll state.
- Move the Assemblies route layout toward full available workbench
  height instead of leaving the canvas stranded in whitespace.
- Convert common toolbar actions to compact icon-first controls where
  the app already has an icon vocabulary.
- Keep Delete and other destructive actions visually explicit.
- Verify editor, locked-version, and viewer modes still hide or disable
  write affordances.

## Out Of Scope

- Redrawing the canvas geometry itself. Phase 14 owns the to-scale
  drawing and hover controls.
- Segment/material dialog polish. Phase 15 owns dialogs and material
  picker UX.
- New backend commands or API changes.
- Reintroducing V1 Material UI styling literally.

## Implementation Notes

- Reuse existing V2 app tokens, buttons, tabs, borders, focus styles,
  and typography. The target is V1 information architecture inside V2
  styling.
- Avoid adding a card inside another card. The Assembly Builder is a
  work surface, not a preview card.
- Keep `EnvelopePage.tsx` primarily as route/query/dialog composition.
  New layout components should live under
  `frontend/src/features/envelope/components/`.
- Do not create a parallel drawer/sidebar implementation if the existing
  `EnvelopeSidebar` can be renamed or adapted cleanly.
- Preserve the existing query and command mutation plumbing. This phase
  should be a layout refactor, not a behavior rewrite.

## Verification

- `git diff --check`
- `cd frontend && pnpm run format`
- `cd frontend && pnpm exec eslint src/features/envelope`
- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- Browser smoke:
  - open a seeded project on Assemblies;
  - switch assemblies from the sidebar/drawer;
  - switch assemblies from the top-bar picker;
  - collapse and reopen the sidebar/drawer;
  - verify zoom and active assembly remain stable;
  - verify locked/viewer modes do not expose write actions.

## Exit Criteria

- The page clearly reads as sidebar/drawer + top-bar + main view.
- The active assembly can be changed from both the sidebar/drawer and
  top bar.
- The canvas area has enough visual priority for Phase 14 to replace the
  scaffold drawing without another shell rewrite.
- Existing targeted Envelope tests pass.

## Implementation Notes - 2026-05-27

- Added an `AssemblyWorkspace` shell so sidebar collapse state stays out
  of the route/query/dialog component.
- Kept both active-assembly switch paths: sidebar rows and top-bar
  picker.
- Kept Delete text-explicit while converting lower-risk top-bar tools to
  icon-first controls.
- Scoped the material legend to materials used by the active assembly.
- Added shared icon-button and tooltip utility styling in base CSS for
  the new controls.
- Added regression coverage for collapse/reopen preserving active
  assembly and canvas zoom.

## Risks

- The route component can grow again if layout logic stays in
  `EnvelopePage.tsx`. Keep layout state local to the new shell
  components where practical.
- Collapsing the sidebar/drawer can accidentally remount the canvas and
  reset scroll/zoom. Preserve component identity where possible and add
  a browser check for this.
