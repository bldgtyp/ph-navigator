# Apertures, Envelope, Climate + Tooltip UI Polish Refactor

DATE: 2026-06-29
TIME: 17:09 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Small UI reliability pass covering shared tooltip behavior,
Envelope/Assemblies sidebar tooltips, project-document Save Version feedback,
Envelope assembly SVG border clipping, Climate map tile-loading feedback, and
the Apertures empty-project state.
RELATED: frontend/src/features/envelope/components/EnvelopeSidebar.tsx;
frontend/src/shared/ui/canvas/canvas-hint-tooltip.css;
frontend/src/styles/base.css;
frontend/src/features/project_document/version-controls.css;
frontend/src/features/project_document/components/VersionControlsMenus.tsx;
frontend/src/features/project_document/components/VersionControls.tsx;
frontend/src/features/project_document/hooks/useDraftLifecycle.ts;
frontend/src/features/envelope/components/AssemblyCanvas.tsx;
frontend/src/features/envelope/components/AssemblySvgCanvas.tsx;
frontend/src/features/climate/components/ClimateMap.tsx;
frontend/src/features/climate/components/climateLeafletMap.ts;
frontend/src/features/apertures/components/AperturesHeader.tsx;
frontend/src/features/apertures/components/ApertureEmptyState.tsx

## Read Order

1. `PRD.md` - behavior contract and UX decision.
2. `TOOLTIP_AUDIT.md` - source review and shared-tooltip recommendation.
3. `PLAN.md` - implementation sequence and verification checks.
4. `STATUS.md` - current state and handoff checklist.

## Why This Is Under `planning/refactor`

The user asked for `planning/refactors` documents. The repo planning rules use
`planning/refactor/<slug>/` for cross-cutting cleanup and polish work, so this
packet follows the repo convention.

## Scope Summary

This refactor owns six small but user-visible fixes:

- Tooltip behavior must be consolidated around one shared, portal-rendered,
  collision-safe primitive so header nav, version menus, canvas sidebars, and
  info hovers use the same styling and stay onscreen.
- Envelope/Assemblies sidebar command tooltips must render above the main
  canvas and must not be clipped by the sidebar list, right edge, or bottom
  edge.
- Save Version must show a full-app blocking progress state while the version
  commit and follow-up cache invalidation are still running.
- Envelope assembly SVG segment borders must remain fully visible, including
  the bottom stroke on the bottommost layer or segment in production.
- Climate maps must show a loading spinner while live Leaflet map tiles are
  still loading, including the main project-location map and the sidebar
  mini-map tile preview.
- `Apertures > Apertures` with no aperture types must show only one large
  primary `Add aperture type` action in the main panel; no fallback title,
  blank U-value chip, or "No aperture types yet." copy.

## Source Anchors

- General `[data-tooltip]` pseudo-element styling lives in `base.css`.
- Project/version header tooltip overrides live in `version-controls.css`, with
  `VersionControlsMenus.tsx` applying `data-tooltip` to the header trigger and
  project action menu items.
- Canvas sidebar/toolbar hint styling lives in `canvas-hint-tooltip.css`, with
  `data-sidebar-tooltip` and `data-toolbar-tooltip`.
- `InfoTooltip.tsx` is a separate pure-CSS info bubble used by Envelope and
  Apertures explanatory chips.
- `CustomFieldDescriptionTooltip.tsx` is the strongest existing precedent for
  a portal-rendered tooltip because it uses Radix Popover, which is already in
  the frontend bundle.
- Sidebar action buttons are rendered by `SidebarActionButton` in
  `EnvelopeSidebar.tsx`.
- The clipped command tooltip is driven by the shared pseudo-element rules in
  `canvas-hint-tooltip.css` via `data-sidebar-tooltip`.
- The assembly long-name tooltip is already portal-rendered from
  `EnvelopeSidebar.tsx`; use it as the local precedent for escaping sidebar
  overflow.
- Save Version controls are rendered by `VersionShellControls`, owned by
  `VersionControls.tsx`, and executed through `useDraftLifecycle`.
- Save success invalidation is centralized in `invalidateProjectDocumentQueries`
  in `project_document/hooks.ts`; it already invalidates project, document,
  table, and Envelope query families.
- Assembly SVG layout is split between `AssemblyCanvas.tsx`,
  `AssemblySvgCanvas.tsx`, and `canvas-geometry.ts`.
- Climate maps are rendered through the shared `ClimateMap.tsx` shell and the
  lazy `climateLeafletMap.ts` controller; the main location map uses
  `.climate-big-map`, while the sidebar preview uses `.climate-mini-map`.
- Apertures empty-project rendering currently flows through `AperturesTab.tsx`,
  `AperturesHeader.tsx`, and `ApertureEmptyState.tsx`.
