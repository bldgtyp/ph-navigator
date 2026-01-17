# Frame Element Tooltip (Window SVG)

**Status:** Implemented
**Created:** 2026-01-17

## Goal

Provide immediate, low‑friction visibility into the frame‑type assigned to each **side** (top/right/bottom/left) of a window element in the SVG view.

## Why

- The table below the SVG is accurate but indirect for quick inspection.
- Frame types can differ per side; users need a fast glance for verification without scrolling or hunting.
- A hover‑only affordance keeps the UI clean and avoids persistent clutter.

## UX Summary

- **Per‑side tooltip** on hover of the frame edge in the SVG.
- **Per‑side highlight** on hover to reinforce which edge the tooltip is describing.
- Tooltip uses existing MUI tooltip styling as seen elsewhere in Windows view (no new visual language for v1).
- Default frame is always present, so no “none” state is required.

## Behavior

1. Hover the **top** frame edge → tooltip displays the top frame type name.
2. Hover the **right** edge → tooltip displays right frame type name.
3. Hover the **bottom** edge → tooltip displays bottom frame type name.
4. Hover the **left** edge → tooltip displays left frame type name.
5. Hover highlight is scoped to the hovered edge only (not the entire element).
6. Tooltip content uses the applied frame type `name` (e.g., “Alpen A1”).

## Placement & Style

- Tooltip: standard MUI `Tooltip` (same behavior as current header/tool buttons).
- Placement: nearest edge with a small offset to avoid covering the edge itself.
- Timing: default MUI delay (consistent with existing usage).

## Data Source

- Frame type names are already present on `ApertureElement.frames.{top|right|bottom|left}.frame_type.name`.
- No new API data required.

## Implementation Anchors

- **SVG side rectangles:**
  - [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.SVG.tsx](../../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.SVG.tsx)
- **Element container hover styles:**
  - [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.Container.tsx](../../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.Container.tsx)
- **Tooltip styling reference:**
  - [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ApertureToolbar.tsx](../../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ApertureToolbar.tsx)
  - [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Aperture.HeaderButtons.tsx](../../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/Aperture.HeaderButtons.tsx)

## Implementation Notes

- Tooltips should be attached per frame edge in the SVG component (per‑side rects are already defined).
- Add a subtle hover fill or stroke change on the hovered edge only (match existing highlight colors).
- Avoid heavy state; keep hover state local to the element or per side for minimal re‑render.

## Acceptance Criteria

- Hovering any frame edge shows the correct frame type name.
- Hover highlight applies only to the hovered edge.
- No layout changes or persistent UI elements are introduced.

## Future Enhancements (Optional)

- Add keyboard focus support if needed later (internal tool today).
- Optional “pin” behavior to keep tooltip open for inspection.
