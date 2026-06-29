# Apertures, Envelope, Climate + Tooltip UI Polish Refactor PRD

DATE: 2026-06-29
TIME: 17:09 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: UI behavior contract for small polish fixes across shared tooltips,
Apertures, Envelope, Climate, and project-document version saving.
RELATED: planning/refactor/envelope-save-ui-polish/PLAN.md;
planning/refactor/envelope-save-ui-polish/TOOLTIP_AUDIT.md;
planning/refactor/envelope-save-ui-polish/STATUS.md

## Problem

Six UI details are undermining trust in otherwise working flows:

1. Tooltip behavior is fragmented across multiple CSS pseudo-element systems,
   local portal implementations, Radix Popover usage, and native `title`
   attributes. Header nav/version menu tooltips can render above the viewport
   or to the left of the menu where they are clipped by the screen. The app
   needs one consistent, collision-aware tooltip system for page chrome.
2. In `Envelope > Assemblies`, sidebar command tooltips for actions such as
   rename, change type, duplicate, and delete are visually behind the assembly
   canvas area or clipped by the sidebar list. The screenshots show right-edge
   clipping and bottom-edge clipping on the last visible sidebar row.
3. When a user clicks `Save Version`, the backend commit succeeds but can feel
   slow. The current UI disables the button and changes the label to
   `Saving...`, but the rest of the app remains visually live while the
   immutable version save and cache invalidation are still running.
4. In `Envelope > Assemblies`, the bottommost SVG segment can lose its bottom
   stroke in production. The local dev route does not consistently reproduce
   the symptom, so the fix must account for browser/subpixel/prod CSS
   differences instead of relying only on the local screenshot state.
5. In `Climate`, live Leaflet basemap tiles can take time to load. The main
   project-location map and the sidebar mini-map preview currently show the
   decorative fallback surface under the tile grid, but no explicit loading
   spinner while tiles are pending.
6. In `Apertures > Apertures`, a new project with zero aperture types renders
   the normal builder header (`Apertures`), a blank `U-Value --` chip, "No
   aperture types yet.", and a small secondary-looking add button. This empty
   state reads as broken. It should reduce to one obvious primary action.

## UX Decision

Use a full-app blocking save overlay for `Save Version`; do not make the
version commit optimistic.

Reasoning:

- The user's edits are already auto-saved as a server draft before they click
  `Save Version`.
- `Save Version` commits that draft into the active immutable version and then
  relies on project/document/table/Envelope query invalidation to refresh stale
  ETags and read models.
- Hiding the dirty state eagerly before the save and invalidations complete can
  falsely imply that the version snapshot exists and can re-open stale identity
  bugs in Envelope workflows.
- Existing stale-version and locked-version dialogs are already the right error
  surfaces. The overlay should disappear on error and let those dialogs or
  inline errors take over.

## Requirements

### R1 - Shared Tooltips Stay Onscreen And Above The App

- App chrome tooltips use one shared visual language:
  - same background color,
  - same foreground color,
  - same font family and size,
  - same radius and shadow,
  - same connector/arrow style,
  - same show/hide delay policy.
- Tooltips render above all page surfaces when their trigger is hovered or
  focused.
- Tooltips are not clipped by local panels, scroll containers, menus, the main
  canvas, or the viewport.
- Tooltip placement is collision-aware:
  - prefer the intended side when it fits,
  - flip to another side when the preferred side would leave the viewport,
  - shift/clamp horizontally and vertically near viewport edges.
- Header/project nav tooltips must not render above the top of the screen.
- Project action menu item tooltips must not render off the left edge of the
  screen.
- Envelope sidebar command tooltips must not be clipped by
  `.envelope-sidebar-list`, `.envelope-sidebar`, `.envelope-workbench`, the main
  canvas, or the viewport bottom/right edge.
- The implementation supports pointer and keyboard focus.
- Tooltip text, icon buttons, menu item labels, and edit permissions remain
  unchanged.
- Viewer mode remains unchanged; unauthorized users do not gain sidebar action
  affordances.

Preferred technical shape:

- Add a shared tooltip primitive under `frontend/src/shared/ui/tooltip/`.
- Render tooltips through a portal to `document.body` using fixed viewport
  positioning.
- Use `@radix-ui/react-popover` as the first-choice substrate because it is
  already installed and already powers the DataTable field-description tooltip.
- If Radix Popover is awkward for hover-only icon hints, write a small
  in-house wrapper plus a pure, unit-tested placement helper.
- Migrate `VersionControlsMenus.tsx` and Envelope sidebar command controls in
  this refactor.
- Treat existing CSS pseudo-element tooltip systems as deprecated for page
  chrome. Do not rely on `z-index` alone; pseudo-elements cannot escape
  ancestor overflow clipping.

### R2 - Save Version Blocks Interaction While Committing

- Clicking `Save Version` displays a full-app ghost/freeze overlay with a
  spinner and concise status text such as `Saving version...`.
- The overlay remains visible until the save mutation and success invalidation
  path complete, or until an error is caught and surfaced.
- While the overlay is visible:
  - pointer interaction with the app is blocked,
  - focus is held inside the progress surface or the surface is announced as a
    modal progress state,
  - the user can see that the app is busy without hunting for a small button
    label.
- On success, the overlay disappears after the dirty draft state is cleared.
- On stale version, locked version, or generic save failure, the overlay
  disappears and existing error handling remains authoritative:
  - `Saved version changed` dialog,
  - `Version locked` dialog,
  - existing inline action error for generic failures.
- Apply the same overlay to save-before-switch (`Save then open`) because that
  path calls the same draft-save operation.
- Consider applying the same overlay to `Save As` if implementation cost is low,
  but do not block this refactor on Save As unless testing shows the same slow
  perception there.

Preferred technical shape:

- Add a small shared blocking progress component, probably under
  `frontend/src/shared/ui/`, rendered through `createPortal(document.body)`.
- Expose a more specific save state from `useDraftLifecycle` instead of using
  the broad `busy` boolean if needed. `busy` currently includes save, save-as,
  discard, lock, and unlock.
- Keep the existing disabled-button behavior in `VersionShellControls`.

### R3 - Bottom SVG Borders Are Always Visible

- Every segment rect in `AssemblySvgCanvas` displays all four strokes.
- The bottom stroke of the bottommost layer remains visible in production and
  local dev at common zoom states, including the first auto-fit zoom and manual
  zoom in/out.
- The fix must not shift layer-dimension controls, segment add controls,
  material assignment controls, or the Exterior/Interior labels out of
  alignment with the SVG geometry.
- The canvas can keep the current compact vertical layout, but it must reserve
  enough layout space for SVG stroke padding and browser subpixel rounding.

Preferred technical shape:

- Audit `AssemblyCanvas.tsx` stage sizing against the actual padded SVG bounds
  from `AssemblySvgCanvas.tsx`.
- Do not depend on negative-positioned SVG padding being visible inside a
  scroll container. Give the stage a real bottom safety gutter or size it to the
  full padded SVG bounds.
- Add a focused regression around the stage/SVG padded bounds, then verify the
  rendered bottom stroke through a browser screenshot or pixel check.

### R4 - Climate Maps Show Tile-Loading Spinners

- Live Climate maps display a loading spinner while raster basemap tiles are
  pending.
- The requirement applies at minimum to:
  - the main `Climate > Project location` map (`.climate-big-map` from
    `ClimateTab.tsx`),
  - the sidebar project-location mini-map (`.climate-mini-map` from
    `ClimateSourceSidebar.tsx`).
- Because all Climate map consumers use `ClimateMap`, the implementation may
  make this shared behavior for dataset picker, weather picker, and
  Set Location maps as well.
- The spinner appears immediately when a live Leaflet map starts initializing
  and remains visible until the current tile layer reports loaded.
- The spinner appears again after map actions that trigger new tile loads, such
  as pan, zoom, basemap reframe, or single-point recenter.
- The spinner clears if Leaflet fails and the component falls back to the
  positioned-pin fallback.
- For decorative/`ariaHidden` mini-maps, the spinner must not add announced
  status text to the accessibility tree. For the main map, a polite status such
  as `Loading map` is acceptable.
- Empty/no-coordinate map surfaces remain decorative and do not need a spinner
  because no live tile request is in flight.

Preferred technical shape:

- Track tile-layer loading in `climateLeafletMap.ts` using Leaflet tile layer
  `loading`, `load`, and `tileerror` events.
- Expose that state back to `ClimateMap.tsx`, likely through an optional
  `onTilesLoadingChange` callback in the controller options.
- Render a small centered overlay inside `.climate-map` using
  `climate-map.css`, so the spinner is clipped to the same rounded map frame.
- Use existing loading-spinner visual language where possible, but keep the
  implementation local if there is no shared spinner primitive yet.

### R5 - Apertures Empty Project Shows One Primary Add Action

- When `Apertures > Apertures` has no aperture types, the main builder panel
  renders only a single large primary-color button labeled `Add aperture type`.
- The zero-aperture main panel must not render:
  - the fallback `Apertures` title,
  - the `U-Value --` chip,
  - the "No aperture types yet." copy,
  - header action icons/overflow controls that only apply to an active
    aperture type.
- The sidebar can keep its `Aperture Types` heading and add/collapse controls.
- The primary empty-state button should call the same `handleAdd()` path as the
  sidebar `+` button.
- The empty state should remain centered in the available main panel, but the
  button should be visually large enough to read as the only intended next
  action.
- Viewer/read-only mode should not show a fake creation affordance. If the user
  cannot edit and there are no aperture types, render a non-action empty panel
  only if needed for layout; do not show the primary button.

Preferred technical shape:

- In `AperturesTab.tsx`, render `AperturesHeader` only when
  `activeAperture !== null`.
- In `ApertureEmptyState.tsx`, remove the explanatory paragraph for editors and
  make the add button use primary-button styling plus an empty-state-specific
  size class.
- Keep `AperturesHeader.tsx` behavior unchanged for existing aperture types.
- Update CSS in `apertures.css` near `.apertures-page__main:has(.apertures-empty)`.

## Non-Goals

- No backend save semantics changes.
- No change to draft auto-save table writes.
- No redesign of the Envelope assembly editor.
- No single PR has to replace every tooltip in the app. This packet should
  create the shared primitive, migrate the observed broken header/version and
  Envelope sidebar surfaces, and document the remaining migration order.
- No production deploy step in this planning packet.
- No new map tile provider or backend proxy work.
- No change to aperture creation semantics or default aperture geometry.

## Acceptance Checks

- Shared tooltip placement coverage proves top, bottom, left, right, and corner
  collision cases stay inside the viewport.
- Project/version control coverage proves header and project action menu
  tooltips render through the shared primitive, not CSS pseudo-elements, and do
  not stay inside `.project-actions-menu`.
- `EnvelopePage.test.tsx` covers the sidebar command tooltip path enough to
  prove it is rendered through the shared primitive outside the clipped sidebar
  list.
- `App.test.tsx` covers a delayed `Save Version` POST:
  - overlay appears while the save promise is pending,
  - controls are blocked/disabled,
  - overlay disappears after success,
  - stale-version error still opens the existing dialog.
- `EnvelopePage.test.tsx` or a focused canvas test covers stage/SVG padding so
  the bottom stroke has reserved layout space.
- `ClimateMap` coverage confirms live-mode tile loading state drives a spinner
  and fallback/test-mode rendering remains stable.
- Apertures builder coverage confirms the zero-aperture state has no fallback
  title, no U-value chip, no "No aperture types yet." text, and exactly one
  visible `Add aperture type` primary action in the main panel.
- Browser verification on `http://localhost:5173` with backend
  `http://localhost:8000` confirms:
  - sidebar tooltips appear in front of the canvas and are not clipped at the
    right or bottom edges,
  - header/version menu tooltips remain fully onscreen and match the shared
    tooltip styling,
  - Save Version shows the full-app progress overlay until completion,
  - bottom SVG borders remain visible for a bottommost assembly segment.
  - Climate main map and sidebar mini-map show a spinner while tiles are
    loading and remove it once tiles load.
  - New-project `Apertures > Apertures` shows only one large primary
    `Add aperture type` action in the main panel.
- For frontend-only implementation, run `make frontend-dev-check`. At final
  closeout before commit, follow the repo gate in `CLAUDE.md`.
