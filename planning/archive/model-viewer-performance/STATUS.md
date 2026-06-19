---
DATE: 2026-06-18
TIME: -
STATUS: Complete
AUTHOR: Claude (Opus 4.8)
SCOPE: Live status ledger for the model-viewer performance refactor. Update
       the per-phase line + "Next step" as work lands. Status vocabulary per
       planning/.instructions.md.
RELATED: ./README.md, ./PRD.md, ./PLAN.md, ./decisions.md
---

# Status

## Current state

**REFACTOR COMPLETE (Phase 05 landed).** Every mesh lens renders on the D-1
`BatchedMesh` substrate; the per-mesh path is gone; the win is locked behind an
automated gate and a clean dispose audit.

**Final numbers (Hillandale, building lens): 14 draw calls @ 60 FPS** — from a
32,045 calls @ 0.4 FPS baseline (Phase-00), via Phase-01's 14,415 @ 1.1. A1
(≤ ~50) and A2 (≥ 45) cleared with wide margin. Lines stay per-object (D-6):
ventilation 227 ducts → ~240 calls @ ~60 FPS.

**Phase 05 added:** the structural perf gate (`perfGate.test.ts` — a lens is
O(1) draw objects regardless of face count, in `make ci`); and a dispose audit
that found + fixed two real CR3 issues the rapid-switch test surfaced — the
StrictMode/rapid-switch `BatchedMesh` crashes (build-in-effect lifecycle +
idempotent `dispose` that hides before freeing) and the `ContactShadows`
`key={lens}` geometry leak (now bakes once; geometry count flat at 12 across 16
switches). Ghost materials are now freed on Canvas unmount too.

The full arc: 03b building lens; 04a spaces + floor-areas (multi-geometry
`batchForId`); 04b site-sun + merged shades + `MeshObject` deleted; 04c
imperative fade-in (`LensBatch.setOpacity` + rAF).

Earlier phases stand: Phase 03 substrate + gate (D-1 locked); merge helpers +
collapsed ghost (Phase 02, ghost = 2 draw calls); shared materials/opaque
shell/one ContactShadows/capped DPR (Phase 01). Two Phase-01 items still await
Ed's review: the **opaque-shell look** (OQ-3 — `working/phase01-opaque-shell.png`)
and the ContactShadows-only ground cue.

## Next step

**None — the refactor is complete.** All phases (00–05) are Done. The win is
gated (`perfGate.test.ts`) and the dispose audit is clean. Optional future work
if ever needed: a true lens cross-fade (04c shipped fade-in only), merging the
duct/pipe lines if a model's line lenses ever drop frames (D-6), and the
deferred OQ-3 opaque-shell look review with Ed.

## Phase ledger

| Phase | Title | Status | Evidence / notes |
|---|---|---|---|
| 00 | Perf harness & baseline | Done | Hillandale building 32,045 calls / 0.4 FPS; spaces 61,785. `working/perf-baseline-phase00.json` |
| 01 | Material & render quick wins (F1,F2,F4,F7) | Done | building 14,415 calls / 1.1 FPS (≈2× win). OQ-1: still O(faces) → Phase 03 required. `working/perf-phase01.json` |
| 02 | Ghost consolidation + merge utils (F5) | Done | `loaders/merge.ts` (unit-tested); ghost = 2 draw calls; spaces 33,728 → 13,517 / ~10 FPS. `working/perf-phase02.json` |
| 03 | BatchedMesh substrate + go/no-go gate (D-1) | Done | `scene/LensBatch.ts` (unit-tested); **gate PASSED** 14 calls / 58.7 FPS. `working/perf-phase03-gate.json` |
| 03b | Building-lens batched migration (F3,F6) | Done | `scene/BatchedLens.tsx` live on building lens; 14 calls / 60 FPS on Hillandale; pick/highlight/theme verified. `working/phase03b-*.png` |
| 04a | Spaces + floor-areas on the substrate (F3) | Done | both lenses via `BatchedLens`; `batchForId` → `BatchLocation[]`; `buildLensBatch` owns per-lens materials. `working/phase04a-*.png` |
| 04b | Site-sun + shades + lines + cleanup (F9) | Done | site-sun batched (geom 124→15), shades merged per group, `MeshObject` deleted, D-6 = lines per-object. `working/phase04b-*.png` |
| 04c | Imperative lens fade-in (F8) | Done | `LensBatch.setOpacity` + rAF fade-in (fade-in only, D-8); early-Z restored. `working/phase04c-*.png` |
| 05 | Hardening + perf gate + docs (A5,CR3) | Done | `perfGate.test.ts` (O(1) draw objects); dispose audit fixed StrictMode crashes + `ContactShadows` leak; geometry flat. `working/phase05-*.png` |

## Open questions / blockers

- **OQ-1 (decided Phase-03 scope) — RESOLVED (no).** Phase 01 alone does **not**
  meet §7 targets: building lens is still 14,415 draw calls (≈2 × faces) @ 1.1
  FPS after the quick wins. Phase 03's BatchedMesh substrate is **required and
  not descopable**. Resolved by the Phase-01 re-measurement (2026-06-18).
- **OQ-2 (D-1 gate) — RESOLVED (yes).** The Phase-03 spike measured the
  Hillandale building lens at **14 draw calls @ 58.7 FPS** (A1 ≤ ~50, A2 ≥ 45
  both cleared), `addGeometry` accepts our non-indexed geometry, `setColorAt`
  applies, dispose is clean, 0 console errors. **D-1 locked: BatchedMesh, no
  merged-vertex-color fallback.** Resolved 2026-06-18.
- **OQ-3 (R5) — awaiting Ed.** The opaque-shell look (F2) shipped in Phase 01.
  "After" screenshot at `working/phase01-opaque-shell.png` (Hillandale, building
  lens). Ed to confirm acceptable vs the old 0.94-transparent faces; reverted
  per-type in `lib/colors.ts` `baseOpacity` if not.
- No external blockers. BatchedMesh + per-instance color/visibility/`batchId`
  raycast are confirmed present in installed `three@0.184.0` (see D-9).

## Verification spine (applies to every phase)

1. `make format` + `make ci` green (mandatory closeout).
2. Playwright MCP walkthrough on both fixtures (small + Hillandale) per
   `planning/archive/model-viewer/AGENT_BROWSER_NOTES.md`; sign in as
   `codex@example.com`.
3. Phase-00 overlay numbers recorded before/after on Hillandale.
4. No regression vs `research/v1-3d-model-viewer-reference.md` §16 and the
   original viewer `UI_SPEC.md` interactions.

## Changelog

- 2026-06-18 — **Phase 05 landed — refactor COMPLETE.** Added the structural
  perf-regression gate (`__tests__/perfGate.test.ts`): a lens builds in ≤ 2
  `BatchedMesh` + 1 edge line regardless of object count (O(1) draw objects, not
  O(faces)), the proxy for draw calls, run in `make ci`. **Dispose audit (CR3)
  via a rapid-switch stress test found + fixed two real issues:** (1) the
  `BatchedLens` `useMemo`-build + `useEffect`-dispose pattern crashed under React
  StrictMode + fast lens switching (disposed-batch reuse → `dispose`/
  `onBeforeRender` null) — fixed by building+disposing in one state-backed effect
  and making `LensBatch.dispose` idempotent + `visible=false`-before-free; (2)
  `ContactShadows key={lens}` leaked ~1 geometry per lens switch (live geometry
  count 46 → 92 over 16 switches) — dropped the key (bakes once per file),
  geometry now flat at 12. Ghost materials freed on Canvas unmount. **24 rapid
  switches → 0 console errors; geometry count flat.** STATUS → Complete; final
  Hillandale building lens **14 calls @ 60 FPS** recorded. Evidence:
  `working/phase05-building-no-leak.png`, `working/phase05-building-after-stress.png`.
- 2026-06-18 — **Phase 04c landed: imperative lens fade-in.** Ed chose fade-in
  only over a true cross-fade (the dual-batch lifecycle wasn't worth the
  CR3/regression risk for polish). `LensBatch.setOpacity(k)` scales every
  material to `k`×base opacity and owns the transparent/depthWrite policy (opaque
  batch blends while fading, restores early-Z at `k>=1`); the batch owns this
  because it owns the materials. `BatchedLens.useLensFadeIn` drives it from a
  self-terminating `requestAnimationFrame` loop in a `useLayoutEffect` (hides
  before first frame → no flash; cleanup cancels on lens/model change) — no
  `useFrame` subscriber, no React state churn (F8), idle after the tween (A6).
  simplify pass: folded the material policy into `setOpacity` (dropped the
  `as Material` casts + reach through optional mesh fields) and replaced the
  `useFrame`/`done`-flag ref with the rAF loop. **Verified in-browser**: building
  solid opaque, spaces 0.32 translucent, early-Z restored, picking intact, 0
  scene errors. Evidence: `working/phase04c-building-settled.png`,
  `working/phase04c-spaces-settled.png`,
  `working/phase04c-building-after-refactor.png`.
- 2026-06-18 — **Phase 04b landed: site-sun batched, shades merged, per-mesh
  path deleted.** site-sun's building context routes through `BatchedLens`
  (`objectsForLens` returns `buildingObjects` for `building` + `site-sun`); geom
  dropped 124 → 15. `SiteSunLayer` is overlays-only (merged shades + compass +
  sun-path) with a `createShadeMaterials` factory (colors.ts). Shades merge per
  `display_name` in `shadeRenderables` — `ShadeRenderable` is now one
  `{ geometry, edges }` per group (D-7/F9); `viewerCore.test.ts` updated for the
  group ids. Deleted `MeshObject` + the dead per-mesh material code
  (`createBuildingMaterials`, `materialFor`, `materialKey`,
  `VIEWER_APERTURE_EDGE_COLOR`, `VIEWER_SPACE_EDGE_COLOR`); `BuildingLens` is now
  a lens-router (ghost + `BatchedLens` + line/site overlays + measure), with the
  line lenses on a line-only filter. **D-6 decided (measured): lines stay
  per-object** — Hillandale ventilation 227 ducts → ~240 calls @ ~60 FPS meets
  A2 despite exceeding the A1 draw-call proxy (decisions.md). Phase 04 was split
  04a/04b/04c; the imperative cross-fade is **04c**. **Verified in-browser**:
  site-sun (batched + merged shades), ventilation/hot-water lines,
  building/spaces/floor regression; 0 scene errors. Evidence:
  `working/phase04b-site-sun.png`, `working/phase04b-hillandale-ventilation.png`,
  `working/phase04b-ventilation-small.png`.
- 2026-06-18 — **Phase 04a landed: spaces + floor-areas on the batched
  substrate.** Generalized `BatchedLens` to render any mesh lens via
  `objectsForLens(model, lens)` (building → prebuilt `buildingObjects`, others →
  filter by lens). `LensBatch.batchForId` became `id → BatchLocation[]` so a
  multi-geometry object (a space's volumes) recolors all its instances — the
  Phase-03b last-wins gap, now closed + unit-tested. `BuildingLens` routes
  `building`/`spaces`/`floor-areas` to `BatchedLens` via a `BATCHED_MESH_LENSES`
  set; site-sun + line lenses stay per-mesh (D-5) until 04b. Phase 04 was split
  into **04a** (this) and **04b** (site-sun, shades, fade, lines, cleanup),
  mirroring 03→03b. simplify pass: moved batch-material ownership into
  `buildLensBatch` (transparent opacity = the batch's transparent type, derived
  next to the opaque/transparent split — `BatchedMesh` has no per-instance
  alpha, so per-lens materials are required), removing the materials `useMemo` +
  dispose effect + object scan from the component, and cached base `Color` by
  type in `buildBatch`. **Verified in-browser** (small fixture): spaces 24 calls
  / translucent 0.32 volumes / full-volume highlight / ventilation-airflow
  legend; floor-areas 9 calls / weighting-factor legend; site-sun unchanged; 0
  scene console errors. Evidence: `working/phase04a-spaces-selected.png`,
  `working/phase04a-spaces-ventilation.png`,
  `working/phase04a-floor-areas-weighting.png`, `working/phase04a-site-sun.png`.
- 2026-06-18 — **Phase 03b landed: building lens migrated to BatchedMesh.**
  Added `scene/BatchedLens.tsx` — mounts `buildLensBatch(model.buildingObjects)`
  via `<primitive>`, owns batch lifecycle (build on model change, `dispose()` on
  change/unmount), and runs ONE `useModelViewerStore.subscribe` color painter
  (F6): repaint-all on theme change, repaint-affected-ids on selection/hover,
  each via `setColorAt` + `invalidate()`. Picking reads `intersect.batchId`
  through R3F primitive handlers → `idForBatch` → object id (D-9), preserving
  drag-vs-click, `stopPropagation`, double-click `zoomTo`, and the Canvas
  `onPointerMissed` clear. `LensBatch.ts` gained the pure, unit-tested
  `resolveInstanceColor` (selected/hover tokens → themed → shaded base);
  `ViewerCanvas` creates + disposes the shared `BatchMaterials` and resolves
  `tokens` once; `BuildingLens` renders `<BatchedLens>` on the building lens and
  keeps `MeshObject`/`LineObject` for the other lenses (temporary dual path, D-5).
  simplify pass applied: promoted `pointerPoint` to `lib/selection.ts` (reuse);
  hoisted `store.getState()` out of the per-object paint loop and cached parsed
  `Color`s by hex (efficiency); documented the intentional flat-highlight (no
  emissive) divergence vs the per-mesh path. **Verified in-browser** (small +
  Hillandale fixtures): building lens **14 draw calls @ 60 FPS** (A1 ≤ ~50,
  A2 ≥ 45 cleared), click-pick + pink highlight + inspector parity, Surface-Type
  / Boundary color-by + legends correct, selection priority preserved, 0 console
  errors. Evidence: `working/phase03b-building-selected.png`,
  `working/phase03b-building-surface-type.png`,
  `working/phase03b-hillandale-building.png`,
  `working/phase03b-post-simplify-boundary.png`.
- 2026-06-18 — **Phase 03 (substrate + gate) landed; D-1 locked.** Added
  `scene/LensBatch.ts` (unit-tested): `buildLensBatch` builds one opaque + one
  glass `THREE.BatchedMesh` + one merged edge `LineSegments`, seeds each
  object's shaded base color via `setColorAt`, and returns `idForBatch` /
  `batchForId` (the D-9 batchId↔object picking/highlight maps) + `dispose()`.
  `lib/colors.ts` gained `createBatchMaterials()` (neutral-white opaque + glass
  batch materials) and `viewerBaseColor()`. **D-1 go/no-go gate PASSED:** a
  throwaway spike measured the Hillandale building lens at **14 draw calls @
  58.7 FPS** (vs. 14,415 @ 1.1), non-indexed geometry accepted, renders
  correctly, 0 console errors → OQ-2 resolved, no fallback. The interactive
  migration (theming/picking/selection + retire per-mesh) was split into
  **Phase 03b**. Data: `working/perf-phase03-gate.json`,
  `working/phase03-batch-spike-building.png`.
- 2026-06-18 — **Phase 02 landed.** Added `loaders/merge.ts` (pure,
  unit-tested): `mergeRenderableGeometries` (returns per-group vertex
  `MergedRange`s for Phase-03 picking) + `mergeEdges` (merged `EdgesGeometry`,
  disposes scratch). The ghost (F5) is now one merged `<mesh>` + one merged
  `<lineSegments>`, **built at model load** — `buildBuildingModel` produces
  `model.ghost = { geometry, edges }` and `disposeBuildingModel` disposes it
  (geometry lifecycle centralized in the loader per the altitude review).
  Ghost materials bundled as `createGhostMaterials(): { fill, edge }`; crease
  angle shared via `EDGE_THRESHOLD_DEGREES` (12°) in `lib/colors.ts`.
  Re-measured on Hillandale: spaces lens **33,728 → 13,517 draw calls**, **0.6
  → ~10 FPS**; ghost = **2 draw calls**. Remaining cost is the active per-face
  lens geometry → Phase 03. Data: `working/perf-phase02.json`. simplify pass:
  reuse/simplification/efficiency clean; altitude's two findings (loader-owned
  ghost lifecycle; bundled ghost materials) applied.
- 2026-06-18 — **Phase 01 landed.** Substrate-agnostic quick wins:
  removed the per-object material clone (deleted `scene/useOpacityMaterial.ts`;
  shared palette/theme materials now pass straight through — F1); opaque shell
  (`faceMesh`/`spaceFloorSegmentMeshFace` opaque, `transparent`/`depthWrite`
  derived from `opacity < 1`; apertures/spaces stay translucent — F2); one baked
  `<ContactShadows frames={1}>` strategy, dropped the Canvas `shadows` flag +
  directional/per-mesh `castShadow` (F4); `dpr={[1,1.5]}` + object-count-gated
  post-FX (SMAA on light models, MSAA on heavy — F7). The 0.18 s lens cross-fade
  (`useLensFade`, two-layer render, per-frame reconcile) was removed; it returns
  as an imperative tween in Phase 04 (D-8). Re-measured on Hillandale: building
  **32,045 → 14,415 calls**, **2,297 → 966 ms**, **0.4 → 1.1 FPS**. **OQ-1
  resolved (no):** still ≈2 × faces draw calls → Phase 03 BatchedMesh required,
  not descopable. OQ-3 (opaque look) + shadow look await Ed's review
  (`working/phase01-opaque-shell.png`). Data: `working/perf-phase01.json`.
- 2026-06-18 — **Phase 00 landed.** Dev-only perf harness added
  (`lib/perf.ts`, `scene/PerfProbe.tsx`, `components/PerfOverlay.tsx`),
  exposed via `window.__phnModelViewerPerf` and a bottom-left overlay. Baseline
  captured on Hillandale + small fixtures, all six lenses
  (`working/perf-baseline.json`). Headline: Hillandale building **32,045 draw
  calls @ ~0.4 FPS / 2.3 s per frame**, spaces **61,785 calls** (ghost-building
  F5). Worse than the review's ~10–14k estimate. Required disabling
  `gl.info.autoReset` + manual per-frame reset so multi-pass `EffectComposer`
  draw calls are counted (a naive read returned ≈ 1).
- 2026-06-18 — Refactor folder created from the 2026-06-18 review. PRD,
  decisions (D-1..D-9), plan, status, and phase docs authored. Substrate
  decision = BatchedMesh; selection/picking API verified against installed
  three 0.184.
