# Apertures, Envelope, Climate + Tooltip UI Polish Refactor Plan

DATE: 2026-06-29
TIME: 17:09 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implementation handoff for shared tooltip consolidation, Save Version
progress, assembly SVG bottom-border visibility, Climate map tile-loading
feedback, and the Apertures zero-type empty state.
RELATED: frontend/src/features/envelope/components/EnvelopeSidebar.tsx;
frontend/src/features/project_document/components/VersionControlsMenus.tsx;
frontend/src/features/project_document/components/VersionControls.tsx;
frontend/src/features/envelope/components/AssemblyCanvas.tsx;
frontend/src/features/climate/components/ClimateMap.tsx;
frontend/src/features/apertures/routes/AperturesTab.tsx;
planning/refactor/envelope-save-ui-polish/TOOLTIP_AUDIT.md

## Phase 0 - Baseline And Reproduction

Goal: reproduce each symptom before changing code, then keep screenshots or
pixel evidence for comparison.

Steps:

1. Run the app locally using the repo-standard ports: frontend `5173`, backend
   `8000`, sign in as `codex@example.com`.
2. Open the project/version action menu from the header and reproduce top/left
   tooltip clipping from the supplied screenshots.
3. Open a project with Envelope assemblies and reproduce sidebar action
   tooltips near the right and bottom edges.
4. Trigger a dirty draft in Envelope, Apertures, or Equipment, then click
   `Save Version` and note the current delay/interaction behavior.
5. Reproduce or approximate the bottom-border clipping with an assembly whose
   final layer sits at the bottom of the canvas. If local dev does not show it,
   capture computed geometry and compare against production screenshot
   symptoms.
6. Open `Climate > Project location` and note tile-load behavior on the main map
   and sidebar mini-map, especially on a cold cache or throttled network.
7. Open a new/empty project at `Apertures > Apertures` and confirm the current
   zero-aperture panel renders fallback title, blank U-value chip, explanatory
   copy, and a small add button as shown in the user screenshot.

Verification:

- Record exact route, browser size, zoom level, and assembly id/name used for
  the smoke check.
- Keep the original user screenshots as symptom references, but do not depend
  on their temporary filesystem paths staying available.

## Phase 1 - Shared Tooltip Primitive And Broken Surface Migration

Status: Implemented on branch `codex/envelope-save-ui-polish` on
2026-06-29. Phase 1 used Radix Popover for portal, flip, shift, and collision
behavior instead of a custom placement helper.

Goal: replace the observed broken pseudo-element tooltip behavior with one
shared, portal-rendered, collision-safe primitive.

Source anchors:

- `frontend/src/styles/base.css`
- `frontend/src/features/project_document/version-controls.css`
- `frontend/src/features/project_document/components/VersionControlsMenus.tsx`
- `frontend/src/shared/ui/data-table/components/CustomFieldDescriptionTooltip.tsx`
- `frontend/src/features/envelope/components/EnvelopeSidebar.tsx`
- `frontend/src/shared/ui/canvas/canvas-hint-tooltip.css`
- `frontend/src/shared/ui/info-tooltip/InfoTooltip.tsx`
- `frontend/src/features/apertures/components/ApertureSidebar.tsx`
- `frontend/src/features/envelope/envelope.css`
- `planning/refactor/envelope-save-ui-polish/TOOLTIP_AUDIT.md`

Implementation notes:

1. Add `frontend/src/shared/ui/tooltip/` with a `Tooltip` primitive, exported
   from `frontend/src/shared/ui/tooltip/index.ts`.
2. Use one canonical CSS file for app chrome tooltips. Match the intended
   dark-panel styling, font, font size, radius, shadow, max width, wrapping,
   and connector/arrow across all migrated surfaces.
3. Prefer `@radix-ui/react-popover` as the substrate because it is already
   installed and used by `CustomFieldDescriptionTooltip`.
4. If Radix Popover cannot satisfy hover/focus icon hints cleanly, write a
   small portal wrapper and pure placement helper instead. Do not add a new
   dependency without a concrete reason.
5. The primitive must portal to `document.body`, use fixed viewport
   positioning, and keep the final tooltip rectangle inside the viewport with
   a small padding. Implemented through Radix Popover collision behavior.
6. Support preferred placements `top`, `bottom`, `right`, and `left`, with
   fallback side selection and final shift/clamp. Implemented through Radix
   Popover `side`, `sideOffset`, and `collisionPadding`.
7. Add `role="tooltip"` and `aria-describedby` only while visible.
8. Hide on pointer leave, blur, Escape, scroll, resize, route unmount, and menu
   close.
9. Migrate `VersionControlsMenus.tsx` first:
   - `VersionPathControls` project action chevron,
   - `VersionShellControls` dirty/save controls,
   - `ProjectActionsMenu` items.
10. Remove or neutralize the duplicated project-document `data-tooltip`
    pseudo-element rules for those migrated controls.
11. Migrate Envelope sidebar action buttons rendered by `SidebarActionButton`
    from `data-sidebar-tooltip` to the shared primitive.
12. Prefer using the same primitive for Envelope long-name tooltips only if it
    is lower risk than preserving the current local portal for this pass.
13. Leave remaining canvas toolbar, Apertures sidebar, InfoTooltip, and native
    `title` cleanup as documented follow-ups unless the new primitive makes a
    specific replacement low-risk while touching the same file.

Testing:

- Add shared tooltip coverage for portal rendering, `role="tooltip"`,
  temporary `aria-describedby`, preservation of existing `aria-describedby`,
  and hover/focus close behavior. Radix owns the viewport collision algorithm,
  so this phase does not keep a local placement-helper test.
- Add or extend project-document component coverage so header/version action
  tooltips render under `document.body`, have `role="tooltip"`, and are not
  children of `.project-actions-menu`.
- Extend `frontend/src/features/envelope/__tests__/EnvelopePage.test.tsx` with
  a command-tooltip test. In JSDOM, assert that the visible tooltip is rendered
  under `document.body`, has `role="tooltip"`, and is not a child of
  `.envelope-sidebar-list`.
- Browser-smoke:
  - header/version trigger near the top edge,
  - `Open version...` action menu item near the left edge,
  - Envelope sidebar command tooltip near the right edge,
  - Envelope sidebar command tooltip near the bottom edge.

## Phase 2 - Blocking Save Version Progress Overlay

Status: Implemented on branch `codex/envelope-save-ui-polish` on
2026-06-29. Phase 2 adds a shared blocking progress overlay and drives it from
the specific `/draft/save` mutation pending state.

Goal: clicking `Save Version` visibly freezes the app until the version commit
and cache invalidation finish.

Source anchors:

- `frontend/src/features/project_document/components/VersionControls.tsx`
- `frontend/src/features/project_document/components/VersionControlsMenus.tsx`
- `frontend/src/features/project_document/hooks/useDraftLifecycle.ts`
- `frontend/src/features/project_document/hooks.ts`
- `frontend/src/styles/modals.css`
- `frontend/src/shared/ui/ModalDialog.tsx`

Implementation notes:

1. Add a shared blocking progress overlay component rendered through
   `createPortal(document.body)`.
2. Style it as a full-viewport ghost/freeze layer using existing modal/scrim
   tokens and a lightweight spinner. Keep the text concise:
   `Saving version...`.
3. In `useDraftLifecycle`, expose a specific save-in-progress flag for the
   draft-save mutation. Do not use broad `busy` unless the product decision is
   to cover save-as/discard/lock too.
4. Render the overlay from `VersionControls` while the save mutation is pending.
5. Keep the existing button disabled state and `Saving...` label.
6. On save success, keep the overlay until `invalidateProjectDocumentQueries`
   has resolved. The current mutation `onSuccess` already returns that promise.
7. On stale/locked/generic errors, remove the overlay and preserve the existing
   dialogs/errors.
8. Apply the same flag to `saveAndOpenVersion`, since it uses the same save
   operation before switching versions.

Testing:

- Add or extend `frontend/src/App.test.tsx` with a delayed save promise.
- Assert a progress surface is visible while the POST to
  `/draft/save` is unresolved.
- Resolve the promise and assert the overlay disappears after the UI has
  refreshed.
- Preserve the existing stale-version test and add an assertion that the overlay
  is gone when the `Saved version changed` dialog appears.

## Phase 3 - Assembly SVG Bottom Stroke Safety Gutter

Goal: reserve enough real layout space for SVG stroke padding so the bottom
segment border cannot be clipped by the scroll container or production browser
rounding.

Source anchors:

- `frontend/src/features/envelope/components/AssemblyCanvas.tsx`
- `frontend/src/features/envelope/components/AssemblySvgCanvas.tsx`
- `frontend/src/features/envelope/canvas-constants.ts`
- `frontend/src/features/envelope/envelope.css`
- `frontend/src/features/envelope/__tests__/EnvelopePage.test.tsx`

Implementation notes:

1. Compare the `AssemblyCanvas` stage dimensions with the actual padded SVG
   dimensions in `AssemblySvgCanvas`.
2. Avoid relying on negative `top` SVG positioning for visible stroke padding
   inside `.assembly-canvas-scroll`.
3. Prefer a real bottom safety gutter or stage height based on the full padded
   SVG bounds plus a small rounding guard.
4. Keep overlay/dimension positioning aligned with the unpadded geometry.
5. Update the existing test that asserts stage height and SVG `viewBox`.
6. Add a browser pixel or screenshot assertion that the bottom stroke is visible
   on the lowest segment.

Testing:

- `cd frontend && pnpm exec vitest run src/features/envelope/__tests__/EnvelopePage.test.tsx`
- Browser check at auto-fit zoom and at least one manual zoom level.
- Confirm the material legend/table below the canvas is not pushed into an
  awkward gap.

## Phase 4 - Climate Map Tile-Loading Spinner

Goal: show explicit loading feedback while live Leaflet basemap tiles are
pending, especially for the main Climate map and sidebar mini-map.

Source anchors:

- `frontend/src/features/climate/components/ClimateMap.tsx`
- `frontend/src/features/climate/components/climateLeafletMap.ts`
- `frontend/src/features/climate/components/ClimateSourceSidebar.tsx`
- `frontend/src/features/climate/routes/ClimateTab.tsx`
- `frontend/src/features/climate/climate-map.css`
- `frontend/src/features/climate/climate-workspace.css`
- `frontend/src/features/climate/__tests__/ClimateMapFallback.test.tsx`

Implementation notes:

1. Keep the behavior in the shared `ClimateMap` surface so `.climate-big-map`
   and `.climate-mini-map` get the same loading treatment.
2. In `climateLeafletMap.ts`, keep a reference to the `L.tileLayer(...)`
   instance instead of adding it inline.
3. Attach tile layer event listeners:
   - `loading` -> loading true,
   - `load` -> loading false,
   - `tileerror` -> avoid leaving the spinner stuck forever; prefer loading
     false after the layer settles, while still allowing the existing fallback
     path for import/controller failures.
4. Pass loading state back to `ClimateMap.tsx` through an optional controller
   option such as `onTilesLoadingChange`.
5. Initialize the visible state to loading when live mode starts and a project
   coordinate exists, so a cold-cache mount shows feedback before the first
   Leaflet event arrives.
6. Render a centered overlay inside `.climate-map`, clipped by the map frame.
7. For `ariaHidden` maps, mark the spinner overlay `aria-hidden="true"`. For
   the main map, expose `role="status"` or equivalent polite text.
8. Preserve the fallback path: JSDOM/test mode and Leaflet import failure should
   not render a permanent spinner.

Testing:

- Add coverage around `ClimateMap` loading state. Because vitest runs
  fallback/test mode by default, either:
  - factor the spinner state into a small testable helper, or
  - mock the live `climateLeafletMap` import in a focused component test.
- Assert `.climate-big-map` and `.climate-mini-map` can both render the spinner
  when live tile loading is true.
- Browser-smoke with throttled network:
  - main Climate location map shows spinner during tile load,
  - sidebar mini-map shows spinner during tile load,
  - both clear after tiles load,
  - maps with unset coordinates remain decorative without spinner.

## Phase 5 - Apertures Zero-Type Empty State

Goal: simplify the empty `Apertures > Apertures` builder state to one obvious
creation action.

Source anchors:

- `frontend/src/features/apertures/routes/AperturesTab.tsx`
- `frontend/src/features/apertures/components/AperturesHeader.tsx`
- `frontend/src/features/apertures/components/ApertureEmptyState.tsx`
- `frontend/src/features/apertures/apertures.css`
- `frontend/src/features/apertures/__tests__/AperturesHeader.test.tsx`

Implementation notes:

1. In `AperturesTab.tsx`, gate `AperturesHeader` behind
   `activeAperture !== null`.
2. Keep `AperturesHeader.tsx` focused on real active aperture types; do not add
   more fallback title/U-value branching inside the header unless the route
   shape makes that materially simpler.
3. Change `ApertureEmptyState` so editor mode renders only one button:
   `Add aperture type`.
4. Style that button as a large primary action, reusing `.primary-button` plus
   an empty-state-specific class if needed.
5. Remove or hide the "No aperture types yet." copy in editor mode.
6. For read-only users with zero aperture types, keep a quiet empty panel and
   no creation button.
7. Preserve the sidebar add button; this request only simplifies the main-panel
   empty state.

Testing:

- Add focused coverage for the zero-aperture builder state. Useful assertions:
  - no heading named `Apertures` inside the main builder panel,
  - no `U-Value` chip,
  - no `No aperture types yet.` text,
  - exactly one main-panel button named `Add aperture type`,
  - clicking it dispatches the existing add path.
- Browser-smoke a fresh/new project on `Apertures > Apertures`.

## Phase 6 - Final Verification

Frontend implementation gate:

- `make frontend-dev-check`

Closeout gate before commit or merge:

- Run the repo closeout sequence from `CLAUDE.md`, including `simplify`,
  `docs-pass`, `make format`, and `make ci` when the implementation is ready
  for commit.
- After modifying code, run `graphify update .` per repo Graphify rules.

Manual browser smoke:

- Header/version trigger tooltip stays fully onscreen at the top edge.
- Project action menu item tooltip stays fully onscreen at the left edge and
  matches the shared tooltip styling.
- Envelope sidebar, row near right edge: rename/change type/duplicate/delete
  tooltip appears fully above the canvas.
- Envelope sidebar, last visible row near bottom edge: tooltip flips or clamps
  instead of being clipped.
- Dirty project document: Save Version displays full-app `Saving version...`
  overlay until completion.
- Stale save response: overlay clears and `Saved version changed` dialog opens.
- Envelope assembly canvas: bottommost segment shows all four borders.
- Climate main map and sidebar mini-map: spinner appears during tile load and
  clears after tile load.
- Empty `Apertures > Apertures`: main panel shows only one large primary
  `Add aperture type` action for editors.
