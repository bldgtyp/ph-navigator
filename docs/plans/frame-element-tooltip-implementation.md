# Frame Element Tooltip - Implementation Plan

**Related Design Doc:** `frame-element-tooltip.md`

**Goal:** Add per‑side hover tooltips and subtle hover highlights for frame edges in the Window SVG.

---

## Phase 1: Understand the SVG Structure

- [x] Read [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.SVG.tsx](../../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.SVG.tsx) to locate top/right/bottom/left frame rectangles
- [x] Read [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.Container.tsx](../../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.Container.tsx) to understand current hover behavior
- [x] Confirm where frame type names are accessed in element data (frame_type name)

---

## Phase 2: Tooltip Content + Hover State

- [x] Add a small utility in `ApertureElement.SVG.tsx` to map frame side → frame type name
- [x] Decide tooltip placement (prefer nearest edge and consistent MUI defaults)
- [x] Add per‑side hover state (local to the SVG component) for the four edges
- [x] Ensure hover state is lightweight (avoid global or context state)

---

## Phase 3: Tooltip UI Integration

- [x] Use MUI `Tooltip` to match existing tooltip styling (see toolbar/header buttons)
- [x] Wrap each frame edge `rect` with a tooltip showing its frame type name
- [x] Ensure tooltip appears only on hover (no persistent UI)

---

## Phase 4: Hover Highlight Styling

- [x] Add a subtle hover style for the specific hovered frame edge (fill or stroke)
- [x] Verify hover highlight does not affect other edges or the full element
- [x] Use existing color variables (e.g., `var(--highlight-light-color)`)

---

## Phase 5: Quality Checks

- [ ] Confirm tooltips show the correct frame type name per edge
- [ ] Verify hover highlight triggers on the correct edge only
- [ ] Verify no layout shifts or overlaps in the SVG
- [ ] Spot-check in logged‑in and logged‑out states

---

## Phase 6: Documentation + Cleanup

- [x] Update [docs/plans/frame-element-tooltip.md](frame-element-tooltip.md) status to “Implemented”
- [x] Add short summary snippet to [context/frontend.md](../../context/frontend.md)
- [ ] Run formatter/linter if needed

---

## File Summary

**Primary files to MODIFY:**

- [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.SVG.tsx](../../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.SVG.tsx)
- [frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.Container.tsx](../../frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/ApertureView/ElementsView/ApertureElement.Container.tsx) (if hover styling is shared)

**Docs to UPDATE:**

- [docs/plans/frame-element-tooltip.md](frame-element-tooltip.md)
- [context/frontend.md](../../context/frontend.md)

---

_Implementation plan created: 2026-01-17_
