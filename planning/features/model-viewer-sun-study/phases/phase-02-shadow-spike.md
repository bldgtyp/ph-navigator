---
DATE: 2026-07-01
TIME: 18:05
STATUS: Pending (blocked by phase 01)
AUTHOR: Claude (for Ed)
SCOPE: Phase 02 — de-risk spike: BatchedMesh × real-time shadow maps
  (PRD §14 top technical risk). No product code lands from this phase;
  findings gate phases 04–05.
RELATED:
  - ../PRD.md §7, §14, D-3/D-4/D-5/D-11
  - frontend/src/features/model_viewer/scene/LensBatch.ts
  - frontend/src/features/model_viewer/scene/ViewerCanvas.tsx
---

# Phase 02 — BatchedMesh × Shadow-Map Spike

## Questions to answer (each gets a written finding)

1. Do `castShadow`/`receiveShadow` work on `THREE.BatchedMesh` (three
   r0.18x) with the substrate's `MeshStandardMaterial`s — including the
   transparent aperture batch?
2. Does a `ShadowMaterial` catcher plane receive batched-mesh shadows
   cleanly at `bounds.min.z`?
3. Is `Canvas shadows` (PCFSoft) free when no `castShadow` light exists
   (the disengaged case, PRD §7)?
4. Does flipping `directionalLight.castShadow` at runtime work without
   remounting the Canvas, and how bad is the first-engage shader
   recompile hitch?
5. Does `clipShadows` on the substrate materials keep sectioned-away
   geometry from casting phantom shadows (D-11), without perturbing the
   batch's fade/opacity material handling?
6. Heavy fixture (Hillandale-scale, local-only via
   `PHN_HILLANDALE_FIXTURE`): frame time + draw calls with one shadow
   pass vs baseline (~60 FPS / 14 calls).

## Method

Temporary dev-knob wiring (behind the existing render-settings debug
panel or a scratch branch commit that is reverted/squashed) + Playwright
screenshots and the perf overlay. Findings written into this doc.

## Exit criteria

Go/no-go recorded for the PRD's shadow design (D-3/D-4/D-5). If broken:
fallback is shades + ground receive only, flagged loudly in STATUS.md
for Ed rather than shipped quietly (PRD §14).

## Findings

- (fill during spike)
