# Tooltip System Audit

DATE: 2026-06-29
TIME: 17:15 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Source review for PH-Navigator tooltip clipping, styling drift, and
collision behavior across header nav, version menus, canvas controls, and
shared info hovers.
RELATED: frontend/src/styles/base.css;
frontend/src/features/project_document/version-controls.css;
frontend/src/features/project_document/components/VersionControlsMenus.tsx;
frontend/src/shared/ui/canvas/canvas-hint-tooltip.css;
frontend/src/shared/ui/info-tooltip/InfoTooltip.tsx;
frontend/src/shared/ui/data-table/components/CustomFieldDescriptionTooltip.tsx;
frontend/src/features/envelope/components/EnvelopeSidebar.tsx;
frontend/src/features/apertures/components/ApertureSidebar.tsx

## Observed Failures

- Header/project nav tooltips can render above the browser viewport from the
  top bar.
- Project action menu item tooltips can render to the left of the menu and
  clip against the viewport edge.
- Envelope sidebar command tooltips can sit behind the main canvas or clip at
  the sidebar/canvas boundary.
- Bottom-row sidebar tooltips can clip against the bottom of the visible
  workbench.

User screenshot references:

- `/Users/em/Desktop/Screenshot 2026-06-29 at 5.09.16 PM.png`
- `/Users/em/Desktop/Screenshot 2026-06-29 at 5.09.23 PM.png`
- `/var/folders/vm/mfby2rkn0g153d2tph6hz8r00000gn/T/TemporaryItems/NSIRD_screencaptureui_eqOMJC/Screenshot 2026-06-29 at 4.52.41 PM.png`
- `/var/folders/vm/mfby2rkn0g153d2tph6hz8r00000gn/T/TemporaryItems/NSIRD_screencaptureui_7hnuKE/Screenshot 2026-06-29 at 4.55.03 PM.png`

## Current Implementations

PH-Navigator currently has several tooltip systems with different styling and
different positioning behavior:

| Surface | Implementation | Source | Current risk |
|---|---|---|---|
| Generic `data-tooltip` | CSS pseudo-element on trigger | `frontend/src/styles/base.css` | Always absolute to trigger; no viewport flip/shift; can render offscreen. |
| Project/version header and menu | Duplicated `data-tooltip` CSS overrides | `frontend/src/features/project_document/version-controls.css` | Header trigger can open outside top viewport; menu items always open left. |
| Canvas toolbar/sidebar controls | CSS pseudo-elements on `data-toolbar-tooltip` / `data-sidebar-tooltip` | `frontend/src/shared/ui/canvas/canvas-hint-tooltip.css` | Cannot escape overflow clipping or stacking contexts. |
| Info `i` bubbles | Pure-CSS child panel | `frontend/src/shared/ui/info-tooltip/InfoTooltip.tsx` | Not portaled; no viewport collision handling. |
| DataTable field descriptions | Radix Popover portal | `frontend/src/shared/ui/data-table/components/CustomFieldDescriptionTooltip.tsx` | Best current precedent; still locally styled and not the app-wide primitive. |
| Apertures sidebar row/action tooltips | Local `createPortal(document.body)` fixed tooltip | `frontend/src/features/apertures/components/ApertureSidebar.tsx` | Escapes clipping but has local styling and limited collision logic. |
| Envelope sidebar long-name tooltip | Local `createPortal(document.body)` fixed tooltip | `frontend/src/features/envelope/components/EnvelopeSidebar.tsx` | Escapes clipping but only covers names, not command buttons. |
| Native browser `title` | Browser tooltip | Multiple UI files | Inconsistent styling; not app-controlled; acceptable only where low-value. |

Leaflet/Recharts/domain tooltips are not part of this UI primitive audit unless
they are being used as page chrome. They have their own rendering models.

## Root Causes

- CSS pseudo-element tooltips are attached to the trigger. They cannot be
  measured, flipped, shifted, or clamped against the viewport.
- `z-index` does not solve overflow clipping. A pseudo-element inside an
  overflow-hidden or scroll container is still clipped by that ancestor.
- The project-document menu explicitly positions tooltips to the left of menu
  items with `right: calc(100% + 10px)`, which fails when the menu itself is
  close to the viewport left edge.
- The topbar/header tooltips use fixed CSS placement relative to a top-edge
  trigger, so there is no room for above-placement bubbles.
- Styling is duplicated across `base.css`, `version-controls.css`,
  `canvas-hint-tooltip.css`, `InfoTooltip.css`, and local sidebar CSS. This is
  why background color, radius, font size, delay, arrow shape, and connector
  behavior drift by surface.

## Recommendation

Create one shared tooltip primitive under `frontend/src/shared/ui/tooltip/`
and migrate high-risk surfaces to it before adding more local fixes.

Minimum primitive contract:

- Render tooltip content through a portal to `document.body`.
- Use `position: fixed` and viewport coordinates from
  `getBoundingClientRect()`.
- Use one visual token set for all app chrome tooltips:
  - background `var(--info-tooltip-bg)` or the chosen canonical dark token,
  - foreground `var(--info-tooltip-fg)`,
  - font family `var(--font-primary)`,
  - font size `var(--fs-sm)` for prose tooltips and one named compact variant
    for icon hints if needed,
  - radius `var(--radius-2xs)`,
  - shadow `var(--shadow-elev-1)` or one chosen tooltip elevation,
  - one connector/arrow style.
- Support placements `top`, `bottom`, `right`, and `left`, with fallback
  placement when the preferred side does not fit.
- Shift/clamp the final rectangle so `left >= viewportPadding`,
  `top >= viewportPadding`, `right <= innerWidth - viewportPadding`, and
  `bottom <= innerHeight - viewportPadding`.
- Keep above all app surfaces with `z-index: var(--z-tooltip)`.
- Support hover and keyboard focus.
- Add `role="tooltip"` and `aria-describedby` only while visible.
- Hide on pointer leave, blur, Escape, scroll, resize, route unmount, and menu
  close.
- Wrap long text with a max width instead of clipping.

Technical choice:

- Prefer using `@radix-ui/react-popover` as the substrate because it is already
  installed and used by `CustomFieldDescriptionTooltip`.
- Do not add `@radix-ui/react-tooltip` unless implementation proves Popover is
  too awkward. The repo's pnpm supply-chain policy makes avoiding new packages
  the conservative path.
- If Radix Popover cannot handle the menu-hover behavior cleanly, implement a
  small in-house wrapper around `createPortal` and a tested placement helper.
  The placement helper should be pure and unit-testable.

## Migration Order

1. Build the shared tooltip primitive and canonical CSS.
2. Migrate the header/version controls first:
   - `VersionPathControls` project action chevron,
   - `VersionShellControls` dirty/save controls,
   - `ProjectActionsMenu` items in `VersionControlsMenus.tsx`.
3. Migrate Envelope sidebar command buttons from `data-sidebar-tooltip` to the
   shared primitive.
4. Replace Apertures sidebar's local floating tooltip with the shared
   primitive so Apertures and Envelope sidebars match.
5. Replace canvas toolbar/sidebar pseudo tooltips where they remain on
   interactive app chrome.
6. Evaluate `InfoTooltip` after the high-risk chrome surfaces. Info bubbles may
   use the same primitive with richer content, but they do not need to block
   the header/sidebar clipping fixes.
7. Leave Leaflet/Recharts and native `title` cleanup as separate follow-up
   audits unless a specific native tooltip is user-visible and problematic.

## Verification

Automated checks:

- Unit-test placement logic with mocked `getBoundingClientRect()` and viewport
  dimensions for top, bottom, left, right, and corner collisions.
- Component-test the project/version menu so tooltips render in
  `document.body`, not inside `.project-actions-menu`.
- Component-test Envelope sidebar command buttons so tooltips render outside
  `.envelope-sidebar-list`.

Browser checks:

- Topbar/version trigger near the top edge opens a tooltip fully onscreen.
- `Open version...` in the project action menu does not clip against the left
  viewport edge.
- Envelope sidebar delete/duplicate tooltips appear above the canvas and are
  not clipped at the right or bottom edge.
- Tooltip background, font, font size, radius, and connector match across the
  header/version menu and Envelope sidebar.
