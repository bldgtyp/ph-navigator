---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 04b — migrate site-sun to the substrate, merge shades per group,
       decide on line merging, and remove the temporary per-mesh dual path.
RELATED: ../PRD.md §4.2, ../decisions.md D-5/D-6/D-7, review F9
RESOLVES: F9 (per-shade meshes); completes D-5/D-7
DEPENDS ON: Phase 04a (spaces + floor-areas on the batched substrate)
---

# Phase 04b — Site-sun, shades, lines, and cleanup

## Goal

With spaces + floor-areas already batched (Phase 04a), complete the migration:
route the site-sun building context through `BatchedLens`; merge shades per
`display_name` group (D-7/F9); decide and record the line-merging question
(D-6); and delete the now-redundant per-mesh `MeshObject` path and dead material
code (D-5). The imperative lens cross-fade (F8/D-8) is split out to **Phase 04c**
— it is a distinct, more complex feature that restores a previously-removed
capability and is cleanest to land once every lens is batched.

## In scope

### 1. Shade groups merged per `display_name` (D-7 / F9)
- `loaders/building.ts` `shadeRenderables` currently emits one renderable per
  shade. Merge each group's geometries (Phase-02 `mergeByGroup`) into one mesh
  per group (matching V1 + original PRD §7). One merged-edge line per group.
  Shades stay non-selectable (as today) unless we opt into the deferred
  "selectable shades" feature (out of scope).

### 2. Lines decision (D-6)
- Measure ventilation + hot-water lenses on Hillandale (Phase-00 overlay).
  Duct/pipe counts are low (hundreds); if they meet §7, **leave lines
  per-object** drei `<Line>` and record that. If they miss, merge into a single
  `LineSegments2` (`LineMaterial`, worldUnits) with a `batchId`-style segment→id
  map for hover/select. Default expectation: leave as-is.

### 3. Migrate site-sun context + remove the temporary dual path (D-5)
- Route the `SiteSunLayer` building context (currently all `buildingObjects` as
  `<MeshObject>`) through `BatchedLens` (lens `site-sun`). With every mesh lens
  then batched, delete the now-dead `MeshObject` (and `LineObject` if lines were
  merged) and the orphaned per-mesh theme-material-clone code
  (`createThemeMaterials`, `createBuildingMaterials` palette, `materialForObject`).
  Tidy `BuildingLens` to a thin lens-router over `BatchedLens` + line/site
  overlays.

## Out of scope

- New features (selectable shades, section planes, etc. — PRD §9).
- Backend changes.

## Risks & mitigations

- **Shade merge parity.** Merging per `display_name` changes shade object ids +
  shape; update `viewerCore.test.ts` and confirm shades still render on site-sun.
- **Dead-code removal regressions.** Removing `MeshObject` may break imports in
  `SiteSunLayer`/tests; run the full frontend suite, not just focused tests.

## Verification

- `make format` + `make ci` green.
- Phase-00 overlay: site-sun / ventilation / hot-water lenses on Hillandale
  within §7 bounds; record the line counts for the D-6 decision.
- Playwright MCP parity on both fixtures: site-sun (batched context + shades +
  compass + sun-path), ventilation + hot-water lines, and a regression sweep of
  building/spaces/floor-areas still selecting + theming.

## Exit criteria

- [x] site-sun building context renders via `BatchedLens` (geom 124 → 15).
- [x] Shades merged per group (D-7/F9); `viewerCore.test.ts` updated.
- [x] Lines decision made + recorded (D-6): leave per-object — see decisions.md.
- [x] `MeshObject` deleted; `BuildingLens` is a thin lens-router (D-5).
- [x] Behavior parity across all lenses (site-sun, ventilation, building) verified.

## Outcome (2026-06-18)

Landed as specified. `objectsForLens` returns `model.buildingObjects` for both
`building` and `site-sun`, so site-sun's context is batched (geom dropped 124 →
15) while `SiteSunLayer` shrank to overlays only (merged shades + compass +
sun-path). Shades merge per `display_name` in the loader (`ShadeRenderable` is
now one `{ geometry, edges }` per group). `MeshObject` + the per-mesh
theme-material code (`createBuildingMaterials`, `materialFor`, `materialKey`,
two edge constants) are deleted; `BuildingLens` is a lens-router. **D-6: lines
stay per-object** — Hillandale ventilation (227 ducts → ~240 calls) renders at
~60 FPS, so it meets the real A2 interaction target despite exceeding the A1
draw-call proxy; merging would add per-segment picking complexity for no
perceptible gain (full rationale in decisions.md). simplify pass: extracted
`createShadeMaterials` (colors.ts factory convention), collapsed the over-broad
lens grouping to a line-only filter, single `isBatched` ternary. Evidence:
`working/phase04b-*.png`. Remaining: the imperative cross-fade is **Phase 04c**.
