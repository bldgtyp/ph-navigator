---
DATE: 2026-07-01
TIME: 16:18 EDT
STATUS: Planned / short feature packet drafted. No implementation started.
AUTHOR: Codex
SCOPE: Router for the Model Viewer ground-shadow/ground-plane correction.
RELATED:
  - PRD.md
  - PLAN.md
  - STATUS.md
  - frontend/src/features/model_viewer/scene/ViewerCanvas.tsx
  - frontend/src/features/model_viewer/components/CameraCluster.tsx
---

# Model Viewer - Ground Shadows

Fix the current visible vertical `ContactShadows` helper plane in the 3D
Model viewer while preserving the intended soft ground-shadow effect: the
model should feel grounded on the grid/ground plane without showing a large
non-model gray sheet behind or through the building.

## Read order

1. `PRD.md` - behavior contract, root-cause hypothesis, acceptance criteria.
2. `PLAN.md` - small implementation sequence and verification gates.
3. `STATUS.md` - current state and next step.

## Current state

Investigation traced the giant non-clickable gray plane to the viewer
rendering helpers rather than HBJSON model data. The strongest candidate
is `ContactShadows` in `ViewerCanvas.tsx`: it creates an internal shadow
receiver plane with `scale={80}` and the current rotation appears wrong for
the viewer's Z-up coordinate system. No implementation has started.
