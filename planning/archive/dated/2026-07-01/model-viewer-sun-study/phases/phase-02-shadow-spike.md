---
DATE: 2026-07-01
TIME: 18:05 (completed 21:45)
STATUS: Complete — GO for the PRD shadow design, with D-11 amended
  (see findings 5).
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

Method: temporary spike edits to `ViewerCanvas`/`BatchedLens`/
`SiteSunLayer` (reverted, not committed), driven in the browser via the
dev render knobs (`__phnViewerRender`) and the perf probe
(`__phnModelViewerPerf`), on the AGENT-BROWSER fixture project. Perf
numbers are orbit-EMA samples (noisy ±2 ms; compare orders, not digits).

1. **BatchedMesh casts + receives: YES.** Both substrate batches
   (opaque faces + transparent apertures, `MeshStandardMaterial`) cast
   and receive with `Canvas shadows="soft"` + one `castShadow`
   directional. Small fixture: crisp raking shadows; re-aiming the key
   via the azimuth/elevation knobs moves them live; self-shading
   correct (the tall block shades the low wing's roof at az 120).
   `assets/phase-02-spike-shadows.png` (small fixture, az 300 / el 35).
2. **ShadowMaterial catcher: YES.** A `planeGeometry` + `shadowMaterial`
   plane at z≈0 receives batched shadows cleanly; invisible except
   where shadow falls (default `planeGeometry` lies in XY — no rotation
   needed in this Z-up scene).
3. **`Canvas shadows` flag alone is FREE.** Small fixture, no caster:
   36 calls / ~8.5 ms with the flag ≡ 36 calls / ~8.8 ms without.
   Phase 04 can set the flag at Canvas creation unconditionally.
4. **Engage cost = +6 draw calls** (shadow depth passes + catcher) on
   both fixtures. Runtime `light.castShadow` flips are supported;
   first engage recompiles programs once (unmeasurable on the small
   fixture; acceptable per PRD §14). Set `receiveShadow` flags at
   mount — free per (3) — and toggle only the light.
5. **D-11 as written does NOT work.** Confirmed in three r0.180 source
   (`WebGLShadowMap.js:432`, `WebGLClipping.js:67`): shadow-pass
   clipping requires `renderer.localClippingEnabled` +
   **material-local** `clippingPlanes` + `clipShadows`; renderer-global
   `gl.clippingPlanes` (what `SectionClippingPlane` uses) are *never*
   applied to the shadow depth pass. Empirically: sectioned-away
   geometry kept casting its full phantom shadow. **Amendment for
   phase 04 (v1): disable the sun shadow pass while a section is
   active** — a sectioned model with live sun shadows is ambiguous
   anyway; the honest alternatives (migrate the section tool to local
   clipping) are a separate refactor.
6. **Heavy fixture (Hillandale, ~7.2k objects, local licensed file):**
   baseline 36 calls / ~15.8 ms orbit-EMA; with full shadow chain
   42 calls / ~12.5 ms — the delta is inside orbit-sampling noise, as
   predicted (casters are 2 batched draws). The spike's fixed ±30
   ortho frustum was too small for a building this size — phase 04
   must fit the shadow camera to `model.bounds` per engage (with the
   fitted frustum the full-building shadow + courtyard self-shading
   rendered correctly; Hillandale screenshots deliberately not
   committed to this public repo).
7. **Apertures cast solid shadows** (shadow depth ignores material
   transparency). Fine for v1 — glass reads as part of the envelope in
   a massing-model shading study; noted as a knob to revisit if Ed
   wants light-through-glass.
