---
DATE: 2026-06-18
TIME: -
STATUS: Complete
AUTHOR: Claude (Opus 4.8)
SCOPE: Product/behavior + target-architecture contract for the model-viewer
       rendering-performance refactor. The "what" and "why"; the per-phase
       "how" lives in phases/. Shipped 2026-06-18 — see STATUS.md.
RELATED:
  - ./README.md, ./PLAN.md, ./STATUS.md, ./decisions.md
  - planning/code-reviews/2026-06-18/model-viewer-large-model-performance.md
  - planning/archive/model-viewer/PRD.md (§7 perf posture, §4 lens/theme model)
  - research/v1-3d-model-viewer-reference.md
---

# PRD — Model Viewer Rendering Performance Refactor

## 1. Problem statement

The R3F model viewer renders one React `<mesh>` + one drei `<Edges>` per
Honeybee face, clones a material per mesh, forces every material transparent,
and layers two shadow passes + an SMAA pass at uncapped DPR. On the Hillandale
fixture (6,178 faces / 1,024 apertures) that is **~14,400 transparent draw
calls with ~7,200 unique materials**, re-rendered under multiple full-scene
passes every interaction frame → single-digit FPS and laggy orbit. Small
models (~110 objects) hide all of this.

The 2026-06-18 review (findings F1–F9) and a read of the V1 source establish
the cause precisely: V1 ran the **same** model acceptably with **no batching**
— it used **shared opaque materials**, **minimal passes**, and an
**imperative (non-R3F) scene** that never paid per-face React cost. V2
reintroduced all of that cost.

## 2. Goals

- **G1 — Interactive on large models.** Smooth orbit/zoom on Hillandale on a
  typical BLDGTYP laptop (target in §7).
- **G2 — Preserve all behavior.** Every lens, theme/color-by mode, selection,
  hover, measure, legend, and inspector field keeps working
  (no regression vs `research/v1-3d-model-viewer-reference.md` §16 and the
  original viewer `UI_SPEC.md`).
- **G3 — Cleaner, more extensible code.** The dense-geometry render path
  should be one coherent, documented module, not 7,200 components each owning
  material/edge/subscription logic. Adding a new lens, theme, or per-object
  toggle should be a localized change.
- **G4 — Honor the original perf posture.** PRD §7 of the original viewer
  ("one material instance per theme bucket (shared)", "one draw call per
  group", "no per-frame allocation in `useFrame`") becomes true in fact.
- **G5 — Lock it in.** A cheap, automated draw-call / frame-budget check on
  the Hillandale fixture so this class of regression cannot silently return
  (the original D-15 "perf canary" measured backend time only and missed it).

## 3. Non-goals

- **N1 — No backend / extraction / transport changes.** D-15 showed the
  pipeline (parse → extract → serialize, 7.4 s) is acceptable; the wire format
  and `/model_data` stay as-is. (Web-workered JSON.parse remains a separately
  tracked open question, not part of this refactor.)
- **N2 — No new viewer features.** Section planes, legend-as-filter, sun-path
  scrubber, etc. from the original PRD §17 stay deferred. We make per-object
  visibility *cheap to add later* (G3) but do not add the UI here.
- **N3 — No visual redesign.** Colors, themes, line styles, and layout are
  preserved; any visual delta (e.g. opaque vs 0.94 faces) is incidental to a
  perf fix and must be reviewed for acceptability, not used as a restyle.
- **N4 — No change to the data contract `ModelObjectMeta`** beyond additive
  fields needed for batched picking; inspector/measure/legend consume it
  unchanged.

## 4. Current vs target architecture

### 4.1 Current (per the review)
- `buildBuildingModel` → `ModelRenderable[]` (one per face/aperture/space/
  floor-seg/duct/pipe), each carrying its own `BufferGeometry[]` + `meta`.
- `BuildingLens` maps each renderable to a memoized `<MeshObject>`/`<LineObject>`.
- Each `<MeshObject>`: a `<group>` → `<mesh>` (+ `castShadow`/`receiveShadow`,
  + drei `<Edges>` child) with `useOpacityMaterial(...)` **cloning** a material,
  and **two Zustand subscriptions** (`hoverId`, `selectionId`).
- Non-building lenses additionally render the whole building as `<GhostBuildingContext>`.
- `ViewerCanvas`: `shadows` + `directionalLight castShadow` + `<ContactShadows>`
  + `<EffectComposer><SMAA/>`, uncapped `dpr`.

### 4.2 Target
- **Geometry stays in the loader as data** (`BufferGeometry` per object +
  `meta`), but the *scene* renders dense mesh geometry as a **single
  `THREE.BatchedMesh` per lens** (D-1), mounted via R3F `<primitive>` and
  driven by an imperative controller. One opaque batch + one transparent batch
  per lens as needed (glass/spaces use the transparent batch).
- **Edges** for a lens merge into **one** `LineSegments` (one
  `BufferGeometryUtils.mergeGeometries` of per-face `EdgesGeometry`), shared
  material.
- **Materials are shared** (the existing `createBuildingMaterials` palette);
  no per-object clones. The batch's base material is shaded white; **color**
  per object is the batch's per-instance color buffer (`setColorAt`).
- **Theming / color-by** = recompute the per-instance color buffer from
  `colorForThemedObject(meta, lens, theme)` (the existing pure function) and
  upload it. No geometry rebuild, no per-mesh materials. "Shaded" = base color.
- **Selection / hover** = `setColorAt(batchId, HIGHLIGHT)` on the hit object
  (+ restore on change). Picking = raycast the BatchedMesh; the hit's
  `batchId` → `meta.id` via an id map; inspector/camera consume `meta` as now.
- **Ghost** = one merged static mesh + one merged edge LineSegments, built
  once per model (Phase 02), reused on every non-building lens.
- **Lines (ducts/pipes)** stay per-object initially (low count, a few hundred);
  revisited only if measured to matter (Phase 04 decision).
- **Render pipeline** = one shadow strategy (baked `ContactShadows frames={1}`
  *or* single directional map, not both), capped `dpr`, post-FX gated on
  object count. Damped `frameloop="demand"` is kept.
- **Measure** is unchanged: it already snaps against `meta.vertices` (model
  data), not scene meshes, so geometry merging does not touch it.

### 4.3 Rendering data model (target shape, informative)
A lens renders from a `LensBatch` built once per model load:
```
LensBatch {                          // as built (Phase 03, scene/LensBatch.ts)
  opaqueMesh:       BatchedMesh | null   // faces (+ floor segs)
  transparentMesh:  BatchedMesh | null   // apertures / spaces (opacity < 1)
  meshes:           BatchedMesh[]        // non-null batches, for raycast/iter
  edges:            LineSegments         // merged edges, one draw call
  idForBatch:  Map<mesh, Map<instanceId, ModelObjectId>>  // picking
  batchForId:  Map<ModelObjectId, {mesh, instanceId}>     // color/highlight
  dispose():   void
}
```
`metaById` (existing) resolves an id to its `ModelObjectMeta` for the
inspector, camera fit, and theming. Exact field names are a Phase-03
implementation detail; this is the contract the rest of the app sees.

## 5. Behavior contract (must not regress)

Mapped from `research/v1-3d-model-viewer-reference.md` §16 and the original
viewer acceptance gate:

- All 6 lenses (building, spaces, floor-areas, site-sun, ventilation,
  hot-water) render and are mutually exclusive; unavailable lenses fall back
  to building.
- All theme/color-by modes per lens (shaded, surface-type, boundary,
  construction, window-construction, ventilation-airflow, weighting-factor),
  including the deterministic `constructionColor` name→hue hash, with legend
  rows + counts matching the rendered colors.
- Selection (click, 5 px drag tolerance), hover, double-click zoom-to,
  click-empty clears, Esc clears / exits measure, Cmd/Ctrl-C copies id.
- Measure: snap-to-vertex, two-click dimension line, CSS2D distance label,
  IP/SI formatting, clears on exit.
- Inspector panel fields per object type; lens cross-fade transition;
  ghost-context appearance on non-building lenses; site compass + sun-path
  + shade groups on site-sun; gizmo + grid + contact shadow ground.
- Z-up camera, `[-25,40,30]` home, fit-on-load.

## 6. Cross-cutting requirements

- **CR1** Backend-only calc rule unaffected (frontend is display only).
- **CR2** Follow `context/CODING_STANDARDS.md` (feature-first, TanStack Query
  for server state, split large files, document the *why*).
- **CR3** Dispose all GPU resources on model swap/unmount (BatchedMesh,
  merged geometries, edge geometry, any materials we own). The current
  `disposeBuildingModel` + per-material dispose effects are the baseline to
  preserve/extend.
- **CR4** `make format` + `make ci` green at every phase closeout; Prettier
  after frontend changes.
- **CR5** No new runtime deps unless justified in `decisions.md` (BatchedMesh
  ships in `three@0.184`; no new dep expected. `r3f-perf` if added is dev-only
  — see D-3).

## 7. Acceptance criteria & performance targets

Measured on the Hillandale fixture, building lens, on Ed's laptop (the
Phase-00 overlay records the device + baseline):

- **A1 — Draw calls:** building-lens steady-state
  `renderer.info.render.calls` drops from ~10–14k to **≤ ~50** (single
  batched mesh + edges + scene chrome + passes). Spaces/floor/site lenses
  similarly bounded (no full-building ghost explosion).
- **A2 — Frame time:** sustained orbit **≥ 45 FPS** (≤ ~22 ms/frame) on
  Hillandale; small fixture stays at refresh cap. (Stretch: 60 FPS.)
- **A3 — Material count:** `renderer.info.memory` / live material instances
  for the building lens is **O(theme buckets)**, not O(faces) — i.e. the
  per-object clone is gone (G4).
- **A4 — Behavior parity:** §5 contract verified via Playwright MCP on both
  fixtures; Vitest + e2e green.
- **A5 — Regression lock:** an automated check (Phase 05) asserts a draw-call
  / object-count ceiling on the Hillandale building lens in CI or a documented
  scripted run, so A1 cannot silently regress.
- **A6 — No idle cost:** `frameloop="demand"` preserved; zero rendering when
  the scene is static (verified: no continuous `useFrame` re-renders/allocs).

## 8. Risks

- **R1 — BatchedMesh maturity / R3F integration.** Newer API, no drei wrapper.
  Mitigation: Phase-03 spike + go/no-go gate with a documented fallback to
  merged-vertex-colors (D-1, same data, different glue).
- **R2 — Picking semantics change.** Moving from per-mesh R3F handlers to a
  single raycast + id map can shift hit-priority/stop-propagation behavior.
  Mitigation: explicit picking tests + Playwright parity pass (Phase 03/04).
- **R3 — Edge fidelity.** Merging per-face `EdgesGeometry` must preserve the
  `threshold={12}` look and per-type edge colors (face vs aperture vs space).
  Per-type edge color may require per-segment vertex colors on the merged
  edge geometry. Tracked in Phase 03.
- **R4 — Transparent ordering.** Glass/space batches remain transparent;
  sorting a *few* batched meshes is cheap, but self-transparency ordering
  within one batch is approximate. Acceptable (matches V1's per-window
  transparency); documented.
- **R5 — Visual delta from opaque faces.** Making the shell opaque (F2) is a
  look change; must be confirmed acceptable by Ed in Phase 01 review.

## 9. Out of scope / deferred

Original viewer PRD §17 opportunities (section planes, legend-as-filter,
per-feature visibility UI, sun-path scrubber, selectable shades/sun-path,
richer pipe inspector, SI-canonical airflow already handled) remain deferred.
This refactor only makes the per-object-visibility ones *cheap to build next*.
