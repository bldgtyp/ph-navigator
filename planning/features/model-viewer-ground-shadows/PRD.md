---
DATE: 2026-07-01
TIME: 16:18 EDT
STATUS: Planned / ready for implementation.
AUTHOR: Codex
SCOPE: Product and behavior contract for Model Viewer ground shadows.
RELATED:
  - README.md
  - PLAN.md
  - STATUS.md
  - frontend/src/features/model_viewer/scene/ViewerCanvas.tsx
---

# PRD - Model Viewer Ground Shadows

## Problem

The 3D Model viewer shows a giant gray vertical plane near/behind the model.
It is only visible from some view angles and cannot be clicked or selected.
This reads like rogue HBJSON geometry but behaves like a scene helper.

Current evidence points to `ContactShadows` in `ViewerCanvas.tsx`:

- It renders a shadow-receiver plane, not model geometry.
- It is configured at `scale={80}`, matching the oversized sheet.
- It is intentionally non-interactive, matching the user's inability to
  select it.
- It is rotated with `rotation={[Math.PI / 2, 0, 0]}` in a Z-up scene,
  which likely orients the helper plane vertically instead of horizontally.

## Goal

Keep a subtle ground-shadow effect while making the helper invisible as a
standalone surface. The viewer should show a grounded white/gray study model,
not a large floating/vertical gray sheet.

## Non-Goals

- Do not change HBJSON extraction or source model data.
- Do not change selection/picking contracts.
- Do not redesign the full model-viewer lighting stack.
- Do not make a production data migration.

## Behavior Contract

1. The Building lens must not show a vertical or free-standing gray plane.
2. The model should still have a soft contact shadow or equivalent grounding
   cue on the grid/ground plane.
3. The ground-shadow helper must remain non-selectable and must not intercept
   hover, click, double-click, measure, or section-plane interactions.
4. The effect must behave consistently across Building, Spaces, Floor Areas,
   Site & Sun, Ventilation, and Hot Water lenses.
5. The effect must remain cheap for both the small seed model and heavy
   uploaded models; avoid real-time shadow-map cost unless measured safe.
6. Section planes must clip model objects only; the ground-shadow helper must
   not read as a model section surface.

## Acceptance Criteria

- Reproduce the current issue on the starter model before the fix.
- After the fix, no large vertical helper plane is visible from orbit views.
- A soft ground/contact shadow or equivalent grounding cue is visible below
  the building in normal views.
- Clicking the former plane area does not select anything and does not block
  selecting visible model objects.
- Fit/home camera controls still frame the model from `model.bounds`, not the
  shadow helper.
- A focused browser smoke captures screenshots for at least:
  Building lens, Site & Sun lens, one line lens, and section plane enabled.
- `make frontend-dev-check` passes.

## Open Questions

- Preferred implementation:
  1. Correct `ContactShadows` orientation/position for Z-up.
  2. Replace `ContactShadows` with a custom horizontal transparent receiver.
  3. Remove the shadow receiver and use only AO/lighting/grid as grounding.

Initial recommendation: try option 1 first because it preserves the intended
effect with the smallest surface area. Fall back to option 2 only if
`ContactShadows` cannot be made visually inert as a plane.
