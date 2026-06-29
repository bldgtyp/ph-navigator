# Apertures, Envelope, Climate + Tooltip UI Polish Refactor Status

DATE: 2026-06-29
TIME: 17:09 EDT
STATUS: Active - Phase 1 implemented on branch
AUTHOR: Codex
SCOPE: Implementation handoff for six UI fixes: shared tooltip consolidation,
Envelope sidebar tooltip layering, project-document Save Version progress
feedback, Envelope assembly SVG bottom-border clipping, Climate map
tile-loading spinners, and Apertures zero-type empty-state cleanup.
RELATED: planning/refactor/envelope-save-ui-polish/README.md;
planning/refactor/envelope-save-ui-polish/PRD.md;
planning/refactor/envelope-save-ui-polish/TOOLTIP_AUDIT.md;
planning/refactor/envelope-save-ui-polish/PLAN.md

## Current State

Phase 1 is implemented on branch `codex/envelope-save-ui-polish`.

Completed in Phase 1:

- Added `frontend/src/shared/ui/tooltip/Tooltip.tsx` as a shared app-chrome
  tooltip primitive backed by Radix Popover, with shared styling in
  `Tooltip.css`.
- Migrated project/version header controls, project action menu items, shell
  dirty/save controls, and Envelope assembly sidebar command controls from
  CSS pseudo-element tooltips to the shared portaled tooltip.
- Removed the duplicated project-document `data-tooltip` pseudo-element rules
  and the Envelope row-action `data-sidebar-tooltip` override that no longer
  applies to the migrated controls.
- Left the Envelope long-name tooltip and canvas toolbar hover hints in place
  because they are separate surfaces; remaining migrations stay follow-up work.

Next active implementation slice: Phase 2, the blocking Save Version progress
overlay.

## Evidence Reviewed

- User screenshots from 2026-06-29 showing:
  - header/project nav tooltip clipped above the viewport,
  - project action menu item tooltip clipped off the left side of the screen,
  - delete/duplicate sidebar command tooltip clipped by the Envelope canvas
    boundary,
  - bottom-row tooltip clipped near the bottom edge,
  - bottom SVG segment border missing in an Envelope assembly canvas.
- `base.css` shows the general `[data-tooltip]::after` implementation uses
  absolute positioning relative to the trigger, with no viewport collision
  logic.
- `version-controls.css` duplicates tooltip styling for project-document
  controls and positions project action menu tooltips to the left with
  `right: calc(100% + 10px)`, matching the clipped screenshot behavior.
- `VersionControlsMenus.tsx` applies `data-tooltip` to the header project
  action trigger and to each project action menu item.
- `EnvelopeSidebar.tsx` shows command buttons use `data-sidebar-tooltip`, while
  the long-name tooltip already uses a `createPortal(document.body)` fixed
  element.
- `canvas-hint-tooltip.css` implements the clipped command tooltips as
  pseudo-elements on the trigger. This cannot escape ancestor overflow.
- `InfoTooltip.tsx` is another pure-CSS tooltip surface and
  `CustomFieldDescriptionTooltip.tsx` is the best current portal precedent
  because it uses Radix Popover, already in the frontend bundle.
- `ApertureSidebar.tsx` has a local portal/fixed tooltip implementation,
  confirming the app already solved clipping locally but not consistently.
- `VersionControls.tsx`, `VersionControlsMenus.tsx`, and
  `useDraftLifecycle.ts` show Save Version already disables controls and
  changes button text while pending, but no app-level overlay exists.
- `project_document/hooks.ts` shows save success awaits
  `invalidateProjectDocumentQueries`, which also invalidates Envelope query
  keys.
- `AssemblyCanvas.tsx` and `AssemblySvgCanvas.tsx` split stage sizing from SVG
  padded bounds; this is the likely place to add a real bottom safety gutter.
- `ClimateMap.tsx` is the shared map shell for the main project-location map,
  sidebar mini-map, picker maps, and Set Location map.
- `climateLeafletMap.ts` creates the Leaflet `L.tileLayer(...)` but currently
  does not expose tile loading state back to React.
- `ClimateSourceSidebar.tsx` renders the sidebar `.climate-mini-map`; `ClimateTab.tsx`
  renders the main `.climate-big-map`.
- User screenshot from 2026-06-29 shows a new-project `Apertures > Apertures`
  empty state with fallback `Apertures` title, blank `U-Value --` chip,
  "No aperture types yet." copy, and a small add button.
- `AperturesTab.tsx` currently renders `AperturesHeader` before branching to
  `ApertureEmptyState` when `activeAperture` is null.
- `AperturesHeader.tsx` falls back to active name `Apertures` and always renders
  `UValueChip`.
- `ApertureEmptyState.tsx` owns the "No aperture types yet." copy and the small
  add button.

## Decisions

- Use `planning/refactor/` rather than `planning/refactors/`, matching the repo
  planning instructions.
- Choose a blocking Save Version overlay over optimistic/eager completion.
- Treat tooltip bugs as a shared-system problem, not another local z-index
  patch. Build one portal-rendered, collision-aware primitive first, then
  migrate the observed broken header/version menu and Envelope sidebar command
  controls.
- Prefer `@radix-ui/react-popover` as the tooltip substrate because it is
  already installed and used by the DataTable field-description tooltip. If
  hover/focus icon hints are awkward with Popover, use a small in-house portal
  wrapper plus a tested placement helper instead of adding a new dependency by
  default.
- Treat the SVG clipping as a production-rendering problem that requires
  browser verification, not only a static CSS/code diff.
- Add Climate map spinners at the shared `ClimateMap` layer so both main and
  sidebar maps inherit the behavior.
- For zero-aperture Apertures builder state, hide the normal header and render
  one primary add action in the main panel.
- Phase 1 used Radix Popover for the shared tooltip instead of custom viewport
  math, matching the existing DataTable field-description tooltip precedent and
  avoiding a bespoke placement engine.

## Next Step

Implement Phase 2 from `PLAN.md`: add the full-app blocking `Save Version`
progress overlay and preserve existing stale/locked/generic save error
handling.

## Verification So Far

Docs-only planning pass:

- Read `planning/.instructions.md` and current planning status.
- Queried Graphify for Envelope/canvas/save surfaces, then inspected source
  files directly because the graph was broad/stale for two of the symptoms.
- Searched current tooltip implementations across `frontend/src` and recorded
  the shared-system audit in `TOOLTIP_AUDIT.md`.
- Reviewed the supplied screenshots with local visual inspection.

Phase 1 implementation verification:

- `pnpm exec vitest run src/shared/ui/tooltip/__tests__/Tooltip.test.tsx src/features/project_document/__tests__/VersionControlsMenus.test.tsx src/features/envelope/__tests__/EnvelopePage.test.tsx`
  passed: 3 files, 53 tests.
- `pnpm run format` completed after implementation.
- `make frontend-dev-check` passed after the final Phase 1 code and docs
  updates. ESLint still reports the pre-existing Fast Refresh warnings in
  unrelated Apertures, Climate, and DataTable files; no errors.
- `make format` completed from the repo root with backend and frontend files
  unchanged.
- `make ci` passed:
  - backend: Ruff format check, Ruff lint, backend boundary check, `ty check`,
    Alembic upgrade, and pytest (`1213 passed`, `2 skipped`);
  - frontend: format check, ESLint (`14` pre-existing Fast Refresh warnings,
    no errors), structural guards, Vitest (`211` files, `1966` tests passed),
    and production build.
- `/simplify` review completed through three parallel review agents. Accepted
  fixes: replaced custom tooltip placement math with Radix Popover, preserved
  pre-existing `aria-describedby`, separated hover and focus open state, and
  extracted project action menu tooltip helpers. Rejected one efficiency note
  to keep version controls on CSS-only tooltips because Phase 1 explicitly
  targets header/menu viewport collision, not only sidebar overflow clipping.
