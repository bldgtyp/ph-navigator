---
DATE: 2026-06-13
TIME: 2026-07-01 14:05 EDT
STATUS: Complete — implementation verified and archived.
AUTHOR: Claude (for Ed)
SCOPE: Implementation handoff — axis-aligned clipping plane.
RELATED:
  - ../PRD.md
  - ../PLAN.md
---

# Phase 1 — Axis clipping

Self-contained frontend handoff (read `../PRD.md` + `../PLAN.md` first).

## 1. Required reading (current code)

- `frontend/src/features/model_viewer/scene/ViewerCanvas.tsx` — the
  `<Canvas>` setup; where to access `gl` and set `clippingPlanes`.
- `frontend/src/features/model_viewer/components/CameraCluster.tsx` —
  the bottom-right control cluster; the section toggle lands here.
- `frontend/src/features/model_viewer/store.ts` — add `section` state +
  resets next to `cameraRequest` / `setActiveFileId`.
- `frontend/src/features/model_viewer/loaders/building.ts` /
  `loaders/bounds.ts` — `model.bounds` for mapping the slider.
- `frontend/src/features/model_viewer/scene/BuildingLens.tsx` — the
  pick path (`selectObject`) if raycast clip-filtering is needed.

## 2. Work

1. **Store:** `section: { axis: 'x'|'y'|'z'; offset: number } | null`;
   actions `setSection`, `clearSection`. Clear in `setActiveFileId`.
2. **Renderer wiring:** a small scene component (or effect in
   `ViewerCanvas`) reads `section` + `model.bounds`, builds a
   `THREE.Plane(normal, constant)`, sets `gl.clippingPlanes = [plane]`,
   and `invalidate()`s. When `section` is null, `gl.clippingPlanes =
   []`. Enable `gl.localClippingEnabled` only if you ever move to
   per-material clipping (not needed for global).
3. **Controls:** section toggle button + an axis segmented control +
   a range slider (offset across the chosen axis bounds). Use the
   existing chrome/token styling. Hidden/cl0sed when section is off.
4. **Pick filtering (spike first):** verify whether raycast hits behind
   the plane need filtering; if so, drop hits with
   `plane.distanceToPoint(hit.point) < 0` in the click path.
5. **Debug hook:** expose `section` on `window.__phnModelViewer` for
   e2e.

## 3. Tests

- **vitest:** axis+offset → plane (normal/constant) and bounds→slider
  range mapping.
- **Playwright:** enable section, set axis + mid offset, assert a face
  known to be on the cut-away side is gone (debug-hook visible ids or a
  screenshot diff), disable, assert it returns.

## 4. Exit criteria

- PRD §4 implementation items are in code; hollow-section limitation
  documented in STATUS (capping is explicitly out of scope).
- Focused Vitest, TypeScript, `make format`, and `make
  frontend-dev-check` are green.
- `tests/e2e/model-viewer-section.spec.ts` and `make ci` are green.
