---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 03 — the architectural core, Step 0: build the reusable
       BatchedMesh lens substrate (`scene/LensBatch.ts`) and run the D-1
       go/no-go gate (OQ-2). The interactive building-lens migration
       (theming/picking/selection + retire per-mesh) is Phase 03b.
RELATED: ../PRD.md §4.2/§4.3, ../decisions.md D-1/D-9, review F3/F6
RESOLVES: substrate for F3 (per-face meshes/edges) — full resolution in 03b
DEPENDS ON: Phase 02 (merge/edge helpers), Phase 01 (shared materials),
            Phase 00 (numbers). **Locks D-1.**
OUTCOME: Gate PASSED. `scene/LensBatch.ts` builds one opaque + one glass
         `BatchedMesh` + one merged edge line with batchId↔object id maps.
         Hillandale building lens measured **14 draw calls @ 58.7 FPS** (vs.
         14,415 @ 1.1). D-1 locked; no fallback. Interactive migration → 03b.
---

# Phase 03 — BatchedMesh substrate + go/no-go gate (Step 0)

## Why this is split

Phase 03 as originally scoped (substrate + theming + picking + selection/hover +
retire the per-mesh path + full parity) is 2–3 sessions and cannot land as one
green, reviewable commit — a half-migrated building lens would break
select/hover/color-by. The phase doc already front-loads a **Step 0 spike & gate**
to resolve the central architectural risk (OQ-2 / D-1) before that investment.
This doc is that gate; the interactive migration is
`phases/phase-03b-building-lens-migration.md`.

## Goal

Build the reusable batched substrate and prove, by measurement on Hillandale,
that `THREE.BatchedMesh` meets §7 targets and integrates with our geometry —
or fall back to merged-vertex-colors. Resolve OQ-2 and lock D-1.

## What shipped

- **`scene/LensBatch.ts` (new, unit-tested).** `buildLensBatch(renderables,
  materials)` partitions building renderables into opaque faces and transparent
  apertures, builds one `BatchedMesh` per partition (reserving vertex/instance
  counts from summed sizes), and merges all edges into one `LineSegments` via
  the Phase-02 `mergeEdges` helper. Each object's geometry is added once and
  seeded to its shaded base color with `setColorAt`. Returns the batches plus
  `idForBatch` (batch instance → object id, for raycast picking) and
  `batchForId` (object id → `{ mesh, instanceId }`, for theming/highlight) — the
  D-9 picking/highlight contract — and a `dispose()` that frees geometry +
  batch textures + the edge material.
- **`lib/colors.ts`.** `createBatchMaterials()` returns the two neutral-white
  batch materials (opaque + transparent glass); per-object hue is driven
  entirely by the per-instance color buffer. `viewerBaseColor(type)` exposes the
  shaded base color so the batch seeds match the per-mesh look.
- Geometries are world-space, so each instance keeps the identity matrix
  `addInstance` assigns — no per-instance transform needed.

## Measured result — OQ-2 ANSWERED (gate PASSED)

A throwaway spike mounted `buildLensBatch(model.buildingObjects)` via
`<primitive>` (shaded only, no picking) and measured the Hillandale building
lens; the spike was then removed (only `LensBatch.ts` + its test ship).

| Metric | Phase 01 (per-mesh) | Phase 03 (batched) | Target |
|---|---|---|---|
| draw calls (whole scene) | 14,415 | **14** | A1 ≤ ~50 |
| FPS (orbit) | 1.1 | **58.7** | A2 ≥ 45 |
| console errors | — | 0 | — |

`addGeometry` accepts our **non-indexed** position+normal faces; `setColorAt`
applies the shaded base colors; the building renders correctly (faces +
apertures + edges + contact shadow); `dispose()` releases buffers. **D-1 is
locked — BatchedMesh, no merged-vertex-color fallback.** Data:
`working/perf-phase03-gate.json`; screenshot
`working/phase03-batch-spike-building.png`.

## Exit criteria

- [x] Spike passed the gate (recorded in D-1; OQ-2 resolved).
- [x] `LensBatch.ts` builds opaque + glass `BatchedMesh` + merged edges with
      round-tripping `idForBatch`/`batchForId` maps; unit-tested; disposable.
- [x] Measured ≤ ~50 draw calls and ≥ 45 FPS on Hillandale (14 / 58.7).
- [ ] _Building lens wired to the substrate with theming/picking/selection
      parity and the per-mesh path retired — moved to **Phase 03b**._

## Out of scope (→ Phase 03b)

- R3F integration of the substrate into the live building lens (`BatchedLens`).
- Theming via `setColorAt`, per-type edge color (R3), picking + selection/hover
  controller (F6, D-9), retiring the building-lens per-mesh path (D-5).
- Spaces / floor-areas / site-sun migration → Phase 04.
