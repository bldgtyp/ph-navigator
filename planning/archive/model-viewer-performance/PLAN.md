---
DATE: 2026-06-18
TIME: -
STATUS: Active
AUTHOR: Claude (Opus 4.8)
SCOPE: High-level implementation sequence + dependency graph for the
       model-viewer performance refactor. The per-phase detail lives in
       phases/phase-NN-*.md.
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./STATUS.md
---

# Implementation Plan

## Sequencing principle

Order by **(value delivered) ÷ (risk)**, front-loading the cheap V1-parity
wins and isolating the one architectural bet (D-1, BatchedMesh) behind a
go/no-go gate so it can be abandoned without losing the earlier gains.

```
Phase 00  Perf harness & baseline
   │        (measurement only; unblocks "before/after" for everything)
   ▼
Phase 01  Material & render-pipeline quick wins   ── ships ≈ V1 parity
   │        F1 share materials · F2 opaque shell · F4 one shadow · F7 dpr/AA
   │        ►► RE-MEASURED: ≈2× win but still 14.4k calls / 1.1 FPS (O(faces)).
   │           OQ-1 resolved (no) → Phase 03 REQUIRED, not descopable.
   ▼
Phase 02  Ghost consolidation + merge utilities          ── DONE
   │        F5 · reusable geometry-merge + edge-merge helpers (loaders/merge.ts)
   │        ►► ghost now 2 draw calls; spaces 33.7k → 13.5k / ~10 FPS.
   │           Remaining cost is the active per-face geometry → Phase 03.
   ▼
Phase 03  BatchedMesh substrate + go/no-go gate    ── DONE (D-1 GATE PASSED)
   │        scene/LensBatch.ts · ►► 14 draw calls @ 58.7 FPS on Hillandale
   │        (vs 14,415 @ 1.1). OQ-2 resolved → no merged-vertex-color fallback.
   ▼
Phase 03b Building-lens batched migration          ── DONE
   │        scene/BatchedLens.tsx · ►► 14 draw calls @ 60 FPS on Hillandale
   │        F3 + F6 + theming-via-setColorAt + picking-via-batchId (D-9)
   │        + retired building-lens per-mesh path (D-5)
   ▼
Phase 04a Spaces + floor-areas on the substrate     ── DONE
   │        both lenses via BatchedLens · batchForId → BatchLocation[]
   │        · buildLensBatch owns per-lens materials (spaces 0.32)
   ▼
Phase 04b Site-sun + shades + lines + cleanup       ── DONE
   │        site-sun batched (geom 124→15) · shades merged per group (D-7,F9)
   │        · D-6: lines per-object · MeshObject + dead material code deleted
   ▼
Phase 04c Imperative lens fade-in                   ── DONE
   │        LensBatch.setOpacity + rAF fade-in (fade-in only, F8,D-8)
   ▼
Phase 05  Hardening, perf regression gate, docs fold-back  ── DONE
            A5 perfGate.test.ts (O(1) draw objects) · dispose audit (CR3)
            · fixed StrictMode crashes + ContactShadows leak · review closed
```

**Refactor complete (2026-06-18): Hillandale building lens 14 draw calls @ 60 FPS
(was 32,045 @ 0.4).**

## Dependency notes

- **00 → everything.** No phase reports "done" without a before/after number
  from the Phase-00 overlay on Hillandale.
- **01 is independent and substrate-agnostic.** It is shippable on its own and
  was the de-risking checkpoint for D-1. **Done + re-measured (2026-06-18):** the
  quick wins roughly halved draw calls (building 32k → 14.4k) but the count is
  still O(faces), so OQ-1 resolved "no" and Phase 03's BatchedMesh is confirmed
  required.
- **02 before 03. Done (2026-06-18):** `loaders/merge.ts`
  (`mergeRenderableGeometries` + `mergeEdges`, unit-tested) is the same
  primitive Phase 03 uses for the batched edges; it was validated on the
  static, non-interactive ghost first (no picking/theming entanglement) and
  collapsed the ghost to 2 draw calls. `MergedRange` is the batchId↔object
  contract Phase 03 reuses for picking.
- **03 before 03b before 04a before 04b.** Phase 03 landed the substrate +
  passed the D-1 gate (14 draw calls @ 58.7 FPS on Hillandale, OQ-2 resolved).
  **Phase 03b done (2026-06-18):** `scene/BatchedLens.tsx` wired the substrate
  into the live building lens (14 calls @ 60 FPS) with one-subscriber
  theming/picking/selection and retired that lens's per-mesh path (D-5).
  **Phase 04a done (2026-06-18):** generalized `BatchedLens` to spaces +
  floor-areas, made `batchForId` multi-geometry, and moved material ownership
  into `buildLensBatch`. **Phase 04b done (2026-06-18):** batched site-sun,
  merged shades per group, deleted `MeshObject` + dead material code, and
  recorded D-6 (lines stay per-object). **Phase 04c done (2026-06-18):** added
  the imperative lens fade-in (`LensBatch.setOpacity` + rAF; fade-in only per
  Ed). Phase 05 is the regression gate + docs fold-back — the final phase.
- **05 last.** The regression gate asserts the end-state; docs fold-back
  follows the docs-pass rule (instructions §Source-Of-Truth 4).

## What each phase changes (file-level, indicative)

| Phase | Primary files touched |
|---|---|
| 00 | `lib/debugHook.ts` (+dev overlay), `working/` baseline notes, this folder |
| 01 | `lib/colors.ts`, `scene/useOpacityMaterial.ts`, `scene/ViewerCanvas.tsx`, `scene/BuildingLens.tsx` |
| 02 | new `loaders/merge.ts` (+ `loaders/edges.ts`), `scene/BuildingLens.tsx` (ghost) |
| 03 | new `scene/LensBatch.ts` (builder + id maps), `lib/colors.ts` (`createBatchMaterials`, `viewerBaseColor`); throwaway spike for the gate |
| 03b | new `scene/BatchedLens.tsx` (+ controller), `scene/BuildingLens.tsx`, picking module, `lib/themes.ts` (color application) |
| 04a | `scene/LensBatch.ts` (multi-geometry `batchForId`, per-lens transparent opacity), `scene/BatchedLens.tsx` (owns materials, any-lens objects), `scene/BuildingLens.tsx` (route spaces/floor to `BatchedLens`), `scene/ViewerCanvas.tsx` (drop batch-material plumbing) |
| 04b | `scene/SiteSunLayer.tsx` (context batched + merged shades), `loaders/building.ts` (shade merge), `scene/BuildingLens.tsx` (route site-sun, delete `MeshObject` + dead material code), `scene/ViewerCanvas.tsx` |
| 04c | `scene/LensBatch.ts` (`setOpacity`), `scene/BatchedLens.tsx` (`useLensFadeIn` rAF fade-in) |
| 05 | a Vitest/e2e perf assertion, dispose paths, `context/` + review STATUS |

(Exact module names are confirmed during each phase; new files prefer the
existing `loaders/` and `scene/` homes and follow `context/CODING_STANDARDS.md`
file-splitting.)

## Estimated shape (not a commitment)

- 00: ~0.5 session · 01: ~1 session · 02: ~1 session · 03: ~1 session
  (substrate + gate, done) · 03b: done (building-lens migration) ·
  04a: done (spaces + floor-areas) · 04b: done (site-sun/shades/lines/cleanup) ·
  04c: done (lens fade-in) · 05: ~1 session.
- Natural PR boundaries = phase boundaries. Each lands green on `make ci`.
