---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 02 — collapse the non-building-lens ghost into one static merged
       mesh, and in doing so build the reusable geometry-merge + edge-merge
       helpers that Phase 03/04 depend on.
RELATED: ../PRD.md §4.2, ../decisions.md D-7, review F5/F9
RESOLVES: F5 (ghost re-renders whole building per non-building lens)
DEPENDS ON: Phase 01 (shared materials in place)
OUTCOME: `loaders/merge.ts` (pure, unit-tested) added; the ghost is now one
         merged mesh + one merged edge line built at model load. Hillandale
         spaces lens dropped 33,728 → 13,517 draw calls and 0.6 → ~10 FPS; the
         ghost itself is 2 draw calls. Remaining cost is the active per-face
         lens geometry, which Phase 03 (BatchedMesh) removes.
---

# Phase 02 — Ghost consolidation + merge utilities

## Goal

Two birds: (1) fix F5 — on every non-building lens the viewer currently
re-renders all ~7,200 building objects as transparent ghost meshes + `<Edges>`
(`GhostBuildingContext`, `BuildingLens.tsx:162`), and (2) build the
**geometry-merge** and **edge-merge** helpers as standalone, tested utilities
on this simpler, non-interactive surface before Phase 03 uses them on the
interactive batched lenses. The ghost is `raycast={() => null}` (non-pickable),
so it is the ideal low-risk place to prove merging.

## In scope

### Merge utilities (new `loaders/merge.ts`)
- `mergeRenderableGeometries(renderables): BufferGeometry` — merge an array of
  per-object `BufferGeometry` into one, via
  `BufferGeometryUtils.mergeGeometries`. Geometries must share attribute layout
  (position + normal; they do — see `loaders/geometry.ts`). Return the merged
  geometry + (for Phase 03) the per-object vertex/triangle ranges so the same
  helper serves batched picking later. Pure, unit-testable.
- `mergeEdges(renderables, threshold): BufferGeometry` — build each object's
  `EdgesGeometry(geometry, threshold)` (preserve the current `threshold={12}`),
  merge into one `LineSegments` geometry. If per-type edge color is needed
  (face vs aperture vs space — `edgeColorForObject`), attach a per-vertex color
  attribute and use a `vertexColors` line material (R3). For the ghost, a
  single ghost edge color suffices.
- Dispose helpers for both.

### Ghost consolidation (`scene/BuildingLens.tsx`)
- Replace `GhostBuildingContext`'s per-object `<mesh>` + `<Edges>` map with:
  - one `<mesh>` using a single merged geometry of `model.buildingObjects`
    (built once per model, memoized; reused across all non-building lenses) +
    the shared ghost material,
  - one merged-edge `<lineSegments>` with the ghost edge material.
- Build the merged ghost once at model load (memoize on `model`), not per lens
  switch. Dispose on model change (CR3).

### Shade pre-merge groundwork (optional here, lands Phase 04)
- If convenient, expose a `mergeByGroup` variant for shades (D-7/F9). Not
  required in Phase 02; noted so the helper is designed to support it.

## Out of scope

- The interactive lenses (building/spaces/floor) stay per-mesh until Phase 03.
- No picking/color changes (ghost is non-interactive).

## What shipped

- **`loaders/merge.ts` (new, pure, unit-tested).** `mergeRenderableGeometries`
  merges an array of `{ geometries }` groups into one `BufferGeometry` via
  `BufferGeometryUtils.mergeGeometries` and returns per-group vertex `ranges`
  (the Phase-03 batched-picking contract). `mergeEdges` builds each group's
  `EdgesGeometry(threshold)` and merges them into one `LineSegments` geometry,
  disposing the scratch edge geometries. Both guard non-indexed position+normal
  input and handle empty input. Tests in `__tests__/merge.test.ts` cover vertex
  sums, range mapping, empty input, the attribute guard, and edge non-emptiness.
- **Ghost owned by the model loader (not the render component).** Per the
  altitude review, `buildBuildingModel` now produces `model.ghost =
  { geometry, edges }` and `disposeBuildingModel` disposes it, so the whole
  geometry lifecycle lives in `loaders/building.ts` next to every other
  geometry's build/dispose (no dispose-split, no leak if a model is built
  without mounting the viewer). `BuildingLens` just renders `model.ghost`.
- **Ghost render collapsed.** `GhostBuildingContext` renders one `<mesh>` +
  one `<lineSegments>` (shared ghost fill + edge materials) instead of mapping
  ~7,200 per-object `<mesh>` + `<Edges>`. The two ghost materials are bundled
  as `createGhostMaterials(): { fill, edge }` (one `useMemo`, one prop).
- **Shared edge threshold.** The crease angle (12°) is now
  `EDGE_THRESHOLD_DEGREES` in `lib/colors.ts`, used by both the live face
  `<Edges>` and the ghost edge merge so the two looks cannot drift.

## Measured result

Re-measured on Hillandale (`perf-6615555h`) via the Phase-00 hook, in-page
orbit, peak `renderer.info.render.calls`:

| Lens   | Calls (01 → 02) | FPS (01 → 02) | Ghost draw calls |
|--------|-----------------|---------------|------------------|
| spaces | 33,728 → **13,517** | 0.6 → **~10** | ~14,400 → **2** |

The ghost is now 2 draw calls regardless of building size. The remaining
13,517 on the spaces lens is the **active** per-space mesh + `<Edges>` geometry
— exactly the O(faces) cost Phase 03's BatchedMesh substrate removes. Data:
`working/perf-phase02.json`; screenshot `working/phase02-ghost-spaces-lens.png`.

## Risks & mitigations

- **R3 edge fidelity.** Merging `EdgesGeometry` must visually match the current
  per-mesh `<Edges>` look. Verify on both fixtures; keep `threshold` identical.
  If per-type colors are needed on interactive lenses, validate the
  vertex-color line approach here first.
- **Attribute-layout mismatch breaks `mergeGeometries`.** All viewer geometries
  come from `geometryFromFace3D` with position+normal only, so layout is
  uniform; add a guard/throw if a geometry lacks expected attributes.
- **Memory.** One merged ghost geometry is far less than 7,200 small ones; net
  win. Confirm dispose on model swap.

## Verification

- `make format` + `make ci` green.
- Unit tests for `loaders/merge.ts` (`__tests__/`): merged vertex count ==
  sum of inputs; edge merge non-empty; ranges map back correctly.
- Phase-00 overlay: switch to spaces/floor/ventilation/hot-water on Hillandale;
  `render.calls` for the ghost drops from ~14k to ~2 (mesh + edges). Record.
- Playwright MCP: ghost appearance on non-building lenses visually unchanged on
  both fixtures.

## Exit criteria

- [x] `loaders/merge.ts` (+ edge merge) exists, pure, unit-tested, disposable.
- [x] Ghost renders as one merged mesh + one merged edge line, built once at
      model load (owned by `buildBuildingModel`/`disposeBuildingModel`).
- [x] Non-building-lens draw calls bounded — the ghost is 2 calls (spaces lens
      33,728 → 13,517; the remainder is the active lens geometry, Phase 03).
- [x] Edge look matches pre-change (R3): same `EDGE_THRESHOLD_DEGREES` (12°),
      verified on Hillandale (`working/phase02-ghost-spaces-lens.png`).
