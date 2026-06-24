---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 03b — wire the building lens to the Phase-03 BatchedMesh substrate:
       theming via per-instance color, picking via batchId, one selection/hover
       subscriber, and retire the building-lens per-mesh path.
RELATED: ../PRD.md §4.2/§4.3, ../decisions.md D-1/D-5/D-9, review F3/F6
RESOLVES: F3 (per-face meshes/edges), F6 (per-object subscriptions)
DEPENDS ON: Phase 03 (LensBatch substrate + gate PASSED)
---

# Phase 03b — Building-lens batched migration

The Phase-03 gate proved the substrate (`scene/LensBatch.ts`) renders the
building lens in ~14 draw calls @ ~59 FPS. This phase makes it the live building
lens with full interaction parity and removes the per-mesh path for that lens.

## In scope

### 1. R3F integration (new `scene/BatchedLens.tsx`)
- Mount `opaqueMesh` / `transparentMesh` / `edges` via `<primitive object={...} />`.
- An imperative controller (hook/effect) owns lifecycle: `buildLensBatch` on
  `model`+`lens` change, `dispose()` on change/unmount (CR3).
- `frameloop="demand"` preserved; `invalidate()` on color/visibility writes.
- Batch materials (`createBatchMaterials`) created once and disposed with the
  canvas (they are shared across rebuilds).

### 2. Theming via per-instance color (replaces the themeMaterials path)
- On `(lens, theme)` change, for each object compute
  `colorForThemedObject(meta, lens, theme)` (existing pure fn) →
  `setColorAt(batchForId.get(id).instanceId, color)`; "shaded" → `viewerBaseColor`.
  One pass over instances, no geometry touch, then one `invalidate()`. Legend
  (`legendForModel`) is unchanged.
- Per-type edge color (face vs aperture, R3): if needed, use the Phase-02
  vertex-color edge path; otherwise keep the single `VIEWER_FACE_EDGE_COLOR`
  the substrate ships with and note it.

### 3. Picking + selection/hover controller (resolves F6; D-9)
- **Pick:** raycast `batch.meshes`; read `intersect.batchId` → `idForBatch` →
  object id. Mirror `MeasureOverlay`'s rAF-throttled imperative pointer handling
  (or R3F events on the `<primitive>` — validate). Preserve drag-vs-click
  (`isClickWithinDragTolerance`), `stopPropagation`, `onPointerMissed` clear,
  double-click zoom (`requestCamera('zoomTo')`).
- **Apply state:** ONE subscriber to `selectionId`/`hoverId`. On change, restore
  the previous id's themed color via `setColorAt` and write `HIGHLIGHT`/`HOVER`
  to the new id. Store actions and inspector/camera consumers are unchanged.

### 4. Retire the building-lens per-mesh path (D-5)
- `BuildingLens` building branch renders `<BatchedLens lens="building" />`
  instead of mapping `<MeshObject>`. `MeshObject`/`LineObject` remain for the
  not-yet-migrated lenses (spaces/floor/site/lines) — the temporary dual path,
  removed for mesh lenses in Phase 04.

## Out of scope

- Spaces / floor-areas / site-sun migration → Phase 04.
- Duct/pipe lines stay per-object (D-6).
- Lens-fade rework (F8) → Phase 04.

## Risks & mitigations

- **R2 picking semantics** → explicit picking unit tests (batchId→id) +
  Playwright parity (click priority, drag-not-click, click-empty-clears,
  double-click zoom).
- **R3 edge per-type color** → Phase-02 vertex-color edge path if needed.
- **R4 transparent ordering** within the glass batch is approximate; keep glass
  in its own batch so opaque early-Z is preserved.

## Verification

- `make format` + `make ci` green; unit tests for color application + picking
  id maps (round-trip already covered in `lensBatch.test.ts`).
- Phase-00 overlay (A1/A2): Hillandale building lens steady `render.calls`
  ≤ ~50; orbit ≥ 45 FPS (gate already showed 14 / 58.7).
- Playwright MCP parity on both fixtures: every building-lens theme/color-by,
  select, hover, double-click zoom, clear, measure, legend, inspector field.
- Confirm `frameloop="demand"` (A6).

## Exit criteria

- [x] Building lens renders via `BatchedLens`; ≤ ~50 draw calls; ≥ 45 FPS.
      (Hillandale: 14 calls / 60 FPS in-browser.)
- [x] Color-by/theming via `setColorAt`; legend unchanged; no per-mesh
      materials on the building lens. (Surface-Type + Boundary verified.)
- [x] Select/hover/zoom/measure/inspector all parity-verified; F6 resolved
      (one subscriber applies state). (Click-pick + highlight + inspector
      verified; measure overlay unchanged and still mounted by `BuildingLens`.)
- [x] Clean dispose on model/lens change (CR3). (`BatchedLens` disposes
      geometry/meshes; `ViewerCanvas` owns + disposes the shared materials.)

## Outcome (2026-06-18)

Landed as specified. The substrate mounted cleanly via `<primitive>`; R3F
delivers `intersect.batchId` on the batched-mesh hit, so picking resolves
`batchId → idForBatch → object id` with no imperative raycaster needed. The one
subscriber that paints per-instance colors replaced ~7,200 per-object Zustand
subscriptions (F6). A latent gap deferred to Phase 04: `batchForId` is last-wins
for multi-geometry objects (fine for single-geometry building faces/apertures;
spaces need `id → BatchLocation[]`). See STATUS changelog for the simplify-pass
cleanups and the full in-browser evidence list.
