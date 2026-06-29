# Apertures, Envelope, Climate + Tooltip UI Polish Refactor Status

DATE: 2026-06-29
TIME: 18:14 EDT
STATUS: Active - Phase 4 implemented on branch
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

Phases 1, 2, 3, and 4 are implemented on branch
`codex/envelope-save-ui-polish`.

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

Completed in Phase 2:

- Added `frontend/src/shared/ui/BlockingProgressOverlay.tsx` and
  `BlockingProgressOverlay.css` as a shared full-viewport blocking progress
  overlay rendered through `createPortal(document.body)`.
- Exposed `savingVersion` from
  `frontend/src/features/project_document/hooks/useDraftLifecycle.ts`, tied to
  the draft-save mutation rather than broad document-control `busy` state.
- Rendered the overlay from `VersionControls` while `Save Version` or
  `Save then open` waits on `/draft/save` and the mutation success
  invalidation path.
- Preserved stale/locked/generic save error handling; the stale-save dialog
  remains authoritative once the save mutation errors.
- Extended `frontend/src/App.test.tsx` with delayed-save coverage for direct
  Save Version and save-before-switch, plus stale-save overlay cleanup.

Completed in Phase 3:

- Added `ASSEMBLY_CANVAS_BOTTOM_SAFETY_GUTTER_PX` and changed Assembly canvas
  stage sizing to reserve the full padded SVG bounds plus a 2px bottom guard.
- Kept segment and layer geometry math unchanged by shifting the overlay plane
  and orientation labels down by the SVG stroke padding, while positioning the
  SVG itself at `top: 0`.
- Extended `EnvelopePage.test.tsx` to assert the new padded stage height,
  visible SVG height, `top: 0` SVG placement, and aligned overlay/label
  geometry plane.
- Browser-smoked the rendered canvas in Chromium on this worktree's
  `http://localhost:5173` route; the SVG starts inside the stage, its bottom
  leaves the 2px guard, and the bottom segment sits inside the SVG padding.

Completed in Phase 4:

- Added an optional `onTilesLoadingChange` callback to the lazy Leaflet map
  controller and wired it to the base tile layer `loading`, `load`, and
  `tileerror` events.
- Added `climateTileLoading.ts` as a small tested pending-tile counter so a
  single tile error settles only that tile and does not clear the spinner while
  other visible tiles are still pending.
- Added shared `ClimateMap` tile-loading state so live maps start with visible
  loading feedback before the first Leaflet tile event arrives.
- Rendered a clipped in-map loading overlay for both `.climate-big-map` and
  `.climate-mini-map`; the main map exposes polite `role="status"` text, while
  decorative/mini-map overlays respect `aria-hidden`.
- Styled the loading surface and spinner in `climate-map.css`.
- Extended `ClimateMapFallback.test.tsx` to assert the accessible main-map
  overlay and decorative mini-map overlay.
- Browser-smoked delayed tile responses in Chromium; both main and sidebar
  map spinners appeared while 22 tile requests were held and cleared after the
  delayed responses completed.

Next active implementation slice: Phase 5, the Apertures zero-type empty
state.

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
- Phase 2 uses the existing TanStack mutation pending state for
  `/draft/save`; because the mutation `onSuccess` returns
  `invalidateProjectDocumentQueries`, the overlay stays mounted through cache
  invalidation without adding a separate timer or optimistic state.
- Phase 3 separates the padded stage bounds from the unpadded geometry plane
  rather than changing segment dimensions. This keeps controls aligned to the
  model geometry while giving the SVG stroke real layout space.
- Phase 4 uses Leaflet tile layer events as the source of truth for loading
  state and keeps the visual treatment at the shared `ClimateMap` layer so the
  main project-location map and sidebar mini-map stay consistent.

## Next Step

Implement Phase 5 from `PLAN.md`: simplify the zero-aperture
`Apertures > Apertures` builder state to one primary `Add aperture type`
action in the main panel.

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

Phase 2 implementation verification:

- `pnpm exec vitest run src/App.test.tsx` passed: 1 file, 28 tests.
- `pnpm run format` completed after implementation.
- `make frontend-dev-check` passed. ESLint still reports the same
  pre-existing `react-refresh/only-export-components` warnings in unrelated
  Apertures, Climate, and DataTable files; no errors.
- `git diff --check` passed.
- Simplify pass tightened the progress overlay to a single visible
  `Saving version...` status line while keeping an accessible dialog name.

Phase 3 implementation verification:

- `pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
  passed: 1 file, 47 tests.
- Browser smoke on `http://localhost:5173` with project
  `d8ec633a-f1b5-458d-b0db-650778849ace` passed geometry guards:
  SVG `top: 0px`, SVG bottom at least 2px above stage bottom, bottom segment
  inside SVG padding, overlay and labels aligned to the geometry plane.
  Screenshot saved at `/tmp/phn-assembly-bottom-stroke-phase3.png`.
- `pnpm run format` completed after implementation.
- `make frontend-dev-check` passed. ESLint still reports the same
  pre-existing `react-refresh/only-export-components` warnings in unrelated
  Apertures, Climate, and DataTable files; no errors.
- `git diff --check` passed.

Phase 4 implementation verification:

- `pnpm exec vitest run src/features/climate/__tests__/ClimateMapFallback.test.tsx src/features/climate/__tests__/ClimateMap.test.ts`
  passed: 2 files, 13 tests.
- Browser smoke on `http://localhost:5173` with delayed tile responses passed:
  both `.climate-big-map` and `.climate-mini-map` showed the loading overlay,
  the main overlay had `role="status"` with text `Loading map`, the mini-map
  overlay had `aria-hidden="true"`, 22 tile requests were delayed, and both
  overlays cleared after tile fulfillment. Screenshot saved at
  `/tmp/phn-climate-map-loading-phase4.png`.
- `make frontend-dev-check` passed. ESLint still reports the same
  pre-existing `react-refresh/only-export-components` warnings in unrelated
  Apertures, Climate, and DataTable files; no errors.
- `git diff --check` passed.
