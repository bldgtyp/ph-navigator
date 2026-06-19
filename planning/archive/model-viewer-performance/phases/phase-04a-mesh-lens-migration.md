---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 04a — generalize the Phase-03b batched substrate to the spaces and
       floor-areas lenses, including the multi-geometry highlight fix.
RELATED: ../PRD.md §4.2, ../decisions.md D-1/D-5, ./phase-03b-building-lens-migration.md
RESOLVES: F3 for the spaces + floor-areas lenses; the multi-geometry `batchForId` gap
DEPENDS ON: Phase 03b (`scene/BatchedLens.tsx` controller + picking + theming)
---

# Phase 04a — Spaces + floor-areas on the batched substrate

Phase 03b proved `BatchedLens` on the building lens. This phase makes the
**spaces** and **floor-areas** lenses render through the same substrate and adds
the multi-geometry highlight fix that spaces require. The **site-sun** building
context stays on `MeshObject` for now — it is migrated in Phase 04b alongside the
shade merge, where retiring `MeshObject` also removes the per-mesh theme-material
clones in one coherent sweep. The cross-fade and lines decision are also 04b.

## In scope

### 1. Per-lens object selection + batch materials
- `BatchedLens` reads `model.buildingObjects` today. Generalize it to render the
  objects of *its* lens (building → `buildingObjects`; spaces → `spaceGroup`
  renderables; floor-areas → `spaceFloorSegmentMeshFace` renderables) via a
  `objectsForLens(model, lens)` helper.
- Batch materials are per-lens because the transparent batch's opacity differs
  by type (apertures 0.68, space volumes 0.32). The opacity is a property of the
  transparent batch, so `buildLensBatch` owns its materials: it derives the
  transparent opacity from its (single) transparent type — adjacent to the
  opaque/transparent split it already does — and frees them in `dispose()`.
  `BatchedLens` just calls `buildLensBatch(objects)`; `ViewerCanvas` stops
  creating/plumbing batch materials. (Per-instance opacity is not an option —
  `BatchedMesh`'s per-instance buffer is color only, no alpha.)

### 2. Multi-geometry highlight fix (the Phase-03b gap)
- A space is one object with several volume geometries, so `batchForId` must map
  `id → BatchLocation[]` (not last-wins). `buildLensBatch` records every
  instance; `BatchedLens` recolors **all** of an object's instances on
  theme/selection/hover. `idForBatch` (instance → id) is unchanged.
- Update `lensBatch.test.ts` for the array shape + a multi-geometry round-trip.

### 3. Theming + group highlight
- Theming reuses `resolveInstanceColor` → `colorForThemedObject`
  (ventilation-airflow for spaces, weighting-factor for floor-areas) — already
  generic over lens/theme. Legends (`legendForModel`) unchanged.
- Selection/hover reuse the Phase-03b single subscriber. Spaces highlight every
  instance of the picked space (covered by the multi-geometry fix); no separate
  `spaceId → batchId[]` walk is needed because one space *is* one object id.

### 4. Route the spaces + floor-areas branches to `BatchedLens`
- `BuildingLens` renders `<BatchedLens>` for `building`, `spaces`, and
  `floor-areas`; the `else` branch now only ever renders `LineObject`
  (ventilation/hot-water). `MeshObject` stays defined and is still used by
  `SiteSunLayer` (site-sun), so no dead-code cascade yet.

## Out of scope (→ Phase 04b)

- site-sun building-context migration, shade group merge (D-7/F9), imperative
  lens cross-fade (F8/D-8), lines merge decision (D-6), and the removal of
  `MeshObject` + the per-mesh theme-material clones.

## Risks & mitigations

- **Transparent opacity per lens** → derive from the lens's transparent type;
  parity-screenshot spaces (0.32) vs apertures (0.68).
- **Multi-geometry highlight** → explicit unit test; Playwright-verify a space
  highlights fully (all volumes), not just one face.
- **Theming coverage** → parity-test ventilation-airflow + weighting-factor
  legends/colors against the pre-change per-mesh look.

## Verification

- `make format` + `make ci` green; `lensBatch.test.ts` covers the array shape.
- Phase-00 overlay on Hillandale: spaces + floor-areas lenses within §7 bounds
  (≤ ~50 calls, ≥ 45 FPS); record.
- Playwright MCP parity on both fixtures: spaces + floor-areas render, theme,
  select (full-object highlight for spaces), hover, inspector, measure.

## Exit criteria

- [x] spaces + floor-areas render via `BatchedLens` (spaces 24 calls, floor 9).
- [x] `batchForId` is `id → BatchLocation[]`; multi-geometry objects highlight
      fully; unit-tested (multi-geometry round-trip test added).
- [x] Per-lens transparent opacity correct (spaces 0.32, apertures 0.68).
- [x] Ventilation-airflow + weighting-factor theming + legends parity-verified.

## Outcome (2026-06-18)

Landed as specified. `BatchedLens` now renders any mesh lens via
`objectsForLens(model, lens)`; `batchForId` became `id → BatchLocation[]` so a
multi-geometry space recolors all its volumes (verified: selecting a space
highlights the whole volume, not one face). The simplify pass moved batch-
material ownership into `buildLensBatch` — the transparent opacity is the
batch's property, derived next to the opaque/transparent split — which removed
the materials `useMemo` + dispose effect and an object scan from the component,
and added a per-type `Color` cache in `buildBatch`. site-sun stays on the
per-mesh path (verified unchanged) until Phase 04b. In-browser parity confirmed
on the small fixture: spaces (translucent 0.32 volumes, ventilation-airflow
legend), floor-areas (weighting-factor legend), full-object highlight, inspector;
0 scene console errors. Evidence: `working/phase04a-*.png`.
