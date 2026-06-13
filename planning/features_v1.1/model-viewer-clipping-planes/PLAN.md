---
DATE: 2026-06-13
TIME: -
STATUS: Deferred — implementation sequence for when the gate opens.
AUTHOR: Claude (for Ed)
SCOPE: Approach + phase sequence for section / clipping planes.
RELATED:
  - PRD.md
  - phases/phase-01-axis-clipping.md
---

# Section / Clipping Planes — PLAN

Frontend-only. No backend, no new data.

| Phase | Scope | Ships |
|---|---|---|
| 1 — Axis clipping | Section toggle + axis pick + slider; global renderer clipping plane; selection/Measure coexistence | Live axis-aligned section across geometry lenses |
| (later, only if needed) Capped sections | Stencil/cap-geometry filled cross-sections | Filled poché — separate effort, gated on "hollow is unreadable" |

## Approach (Phase 1)

- **Global clipping, not per-material.** Set `gl.clippingPlanes =
  [plane]` (via `useThree().gl`) so the single `THREE.Plane` clips
  every material in the scene — this sidesteps the MVP's shared/derived
  materials (D-09): no need to set `clippingPlanes` on each
  `MeshStandardMaterial` / `MeshBasicMaterial` / `LineMaterial`
  instance. Clear by setting `gl.clippingPlanes = []`.
- **Plane from axis + offset.** Normal = chosen axis; constant =
  mapped from the slider across `model.bounds` on that axis. Recompute
  the plane only on slider change.
- **State** on `modelViewerStore`: `section: { axis: 'x'|'y'|'z';
  offset: number } | null`. Clear on `setActiveFileId`. (Lens switch:
  keep — see PRD §2.5; confirm at promotion.)
- **`frameloop="demand"`** — `invalidate()` on plane change.
- **Selection** — clipped fragments are not rendered, but raycasting in
  three.js still hits geometry behind a clip plane unless the raycaster
  is told otherwise. Filter raycast hits by the plane
  (`plane.distanceToPoint(hit.point) >= 0`) in the pick path, or accept
  that only visible-side picks matter and gate in the click handler.
  Resolve during implementation with a quick spike.

## The one real risk

**Capped cross-sections are hard in three.js.** Out of scope here
(PRD §3). If hollow sections (you see through the cut shell into the
backfaces) read poorly, that is a separate, larger effort
(stencil-buffer capping or generated cap geometry). Do not let it
creep into Phase 1.

## Why gated, not just sequenced

Per Q-VIEW-8 and the post-MVP PRD, this ships "only when a concrete
review workflow needs sectioned model inspection." The plan is ready;
the trigger is a real use case, not engineering readiness.
