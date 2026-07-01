---
DATE: 2026-06-13
TIME: 2026-07-01 14:05 EDT
STATUS: Complete — Phase 1 implemented, verified, and archived.
AUTHOR: Claude (for Ed)
SCOPE: Product / behavior contract for section / clipping planes.
RELATED:
  - README.md
  - PLAN.md
  - context/user-stories/40-model-viewer.md (Q-VIEW-8)
---

# Section / Clipping Planes — PRD

## 1. Goal

Let a reviewer cut the model with a movable plane to inspect interiors
and sections without disassembling the view. Works across the geometry
lenses (Building, Spaces, Floor Areas, Site & Sun), which is where
section inspection is meaningful.

## 2. Behavior contract (MVP scope for this feature)

1. **Toggle a section mode** from the camera/tool cluster (bottom-right,
   alongside the existing camera buttons). Off by default; the viewer
   is unchanged until enabled.
2. **Axis-aligned plane to start.** A single clipping plane normal to a
   chosen axis (X / Y / Z), with a slider (or drag handle) to move it
   through the model's bounds. Axis-aligned covers the dominant cases
   (plan cut at a Z height, section through X or Y) with no gizmo
   complexity.
3. **Live cut.** Everything in front of the plane is clipped away in
   real time as the slider moves; the rest of the scene (lighting,
   shadows, selection, inspector) behaves normally.
4. **Selection still works on the cut model.** Picking a visible
   (un-clipped) face opens the inspector as usual. Clipped-away
   geometry is not pickable.
5. **Clear / disable** restores the full model. Switching file clears
   the section. Switching lens keeps the section (it is a camera-ish
   tool, not lens state) — confirm with Ed at promotion; default to
   "section persists across lens, clears on file/section-off."
6. **Measure + section coexist** — Measure can snap to visible cut
   edges' source vertices; no special rule beyond the existing Measure
   lifecycle.

## 3. Explicitly out of scope (this feature)

- **Capped cross-sections** (a solid fill where the plane cuts through
  solids, so the section reads as a filled poché rather than hollow
  shells). This is a known three.js gap requiring stencil-buffer
  tricks or cap-geometry generation. It is the expensive part; defer
  to a follow-up only if reviewers find hollow sections unreadable.
- **Arbitrary (non-axis) plane orientation** via a 3D gizmo.
- **Multiple simultaneous planes / box clipping.**
- **Saving section state in the URL.** (Selection/camera are already
  out of the deep-link per D-10; section follows that precedent.)

## 4. Acceptance gate (when built)

1. Enabling section + moving the slider cuts the model live on the
   chosen axis across the geometry lenses.
2. Selection/inspector and Measure work on the cut model.
3. Disable / file-switch restores the full model.
4. `frameloop="demand"` respected — plane moves repaint without manual
   camera nudges; no per-frame allocation while idle.
5. `make ci` green; focused vitest (plane math / bounds mapping) +
   Playwright (enable, move, assert a known face clipped, disable).
