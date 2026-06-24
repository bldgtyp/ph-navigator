---
DATE: 2026-06-18
TIME: -
STATUS: Active
AUTHOR: Claude (Opus 4.8)
SCOPE: Accepted/rejected decisions for the model-viewer performance refactor.
       Each decision is referenced by id (D-N) from the PRD and phase plans.
RELATED: ./PRD.md, ./PLAN.md, ./README.md,
         planning/code-reviews/2026-06-18/model-viewer-large-model-performance.md
---

# Decisions

## D-1 — Dense geometry renders as `THREE.BatchedMesh` per lens — **Accepted (confirm at Phase-03 gate)**

**Decision.** Replace per-face `<mesh>` + `<Edges>` with a single
`THREE.BatchedMesh` per lens (one opaque batch, one transparent batch where
needed) plus one merged edge `LineSegments`. Per-object color, visibility, and
picking use BatchedMesh's first-class per-instance API. Mounted in R3F via
`<primitive>` and driven by an imperative controller.

**Why.** The viewer's defining interactions — recolor individual faces
(color-by, the central feature), click them (picking), highlight (select/
hover), and the already-planned "hide a category of faces" — are first-class
ops on BatchedMesh (`setColorAt`, `setVisibleAt`, raycast→`batchId`) and
manual buffer bookkeeping on every alternative. It also gives per-object
frustum culling for free. This reproduces V1's proven "one shared geometry
object, raycast it, recolor the hit" model (V1 stayed fast precisely because
the scene was a single imperative structure, not per-face React) while keeping
R3F for the UI shell. `three@0.184` ships BatchedMesh as a stable core class.

**Rejected alternative — Merged `BufferGeometry` + per-vertex color attribute.**
One big geometry per material bucket; recolor by rewriting a color attribute
range. Equally fast and more API-mature, but per-object ops require us to own
a vertex-range + triangle→id table forever, and per-object visibility means
rebuilding the index buffer. More fragile bookkeeping for the exact operations
this viewer does most. **Kept as the documented Phase-03 fallback** (R1): same
loader data, different "glue", swap is contained to the scene layer.

**Rejected alternative — Keep per-mesh, just fix F1/F2/F4/F7 (Phase 01 only).**
This reaches ≈ V1 render parity but keeps the R3F per-face reconciliation +
per-face Zustand subscriptions that V1 never paid. Good enough might be good
enough — so Phase 01 ships first and we **re-measure before committing to
D-1**. If Phase 01 alone meets §7 targets on Hillandale, Phase 03 can be
descoped to "merge edges + ghost only".

**Outcome (2026-06-18, OQ-1 resolved).** Phase 01 shipped and was re-measured:
building lens dropped from 32,045 → 14,415 draw calls and 2,297 → 966 ms/frame
(≈2× win), but 14,415 ≈ 2 × 7,202 faces is still O(faces) and 1.1 FPS is far
from §7 (A1 ≤ ~50, A2 ≥ 45). **Phase 01 alone does NOT meet targets**, so this
"Phase 01 only" alternative is **rejected** and the full D-1 BatchedMesh
substrate (Phase 03) is confirmed required — not descopable.

**Gate.** Phase 03 begins with a spike: build *only* the building lens on
BatchedMesh against Hillandale and measure (A1/A2). Proceed only if it meets
targets and integrates cleanly with R3F raycasting + dispose; otherwise fall
back to the merged-vertex-color path. Record the gate outcome here.

**Gate outcome (2026-06-18, OQ-2 resolved — PASSED).** A throwaway spike mounted
`buildLensBatch(model.buildingObjects)` (new `scene/LensBatch.ts`) via
`<primitive>` and measured the Hillandale building lens: **14 total scene draw
calls @ 58.7 FPS** (vs. Phase-01's 14,415 calls @ 1.1 FPS) — A1 (≤ ~50) and A2
(≥ 45) both cleared with wide margin, 0 console errors, renders correctly.
Confirmed in-browser: `BatchedMesh.addGeometry` accepts our **non-indexed**
position+normal face geometries, `setColorAt` applies per-instance shaded base
colors, and `dispose()` releases buffers. **D-1 is locked: BatchedMesh is the
substrate; the merged-vertex-color fallback is NOT needed.** The interactive
migration (theming/picking/selection + retire per-mesh) is split into Phase 03b.

## D-2 — One shadow strategy, not two — **Accepted**

Drop the redundant pairing of a real-time directional shadow map **and**
`<ContactShadows>` (default `frames={Infinity}`, re-renders the scene every
frame). Keep `<ContactShadows>` baked with **`frames={1}`** (render once after
load / on model change) as the ground-contact cue, and drop the directional
`castShadow` (or vice-versa — pick the better-looking one in Phase 01). V1 ran
a single directional map + a static `ShadowMaterial` receiver and looked fine.
Add a "shadows off above N objects" escape hatch if needed.

## D-3 — Dev-only perf instrumentation — **Accepted**

Phase 00 adds a dev-only overlay surfacing `renderer.info.render.calls`,
triangles, and frame time, plus a documented Playwright MCP procedure on
Hillandale. Prefer extending the existing `lib/debugHook.ts`
(`ModelViewerDebugBridge`) to expose `gl.info` over adding `r3f-perf`; if
`r3f-perf` is added it is a **devDependency**, gated behind the existing debug
hook, never in the production bundle. Respect pnpm supply-chain settings
(24 h `minimumReleaseAge`, etc.).

## D-4 — Cap DPR and gate post-processing — **Accepted**

Set `<Canvas dpr={[1, 1.5]}>` (V1 capped at `min(dpr,2)`; on this scene even 2
is costly). Consider `<AdaptiveDpr>` to drop DPR during orbit. Gate the
`<EffectComposer><SMAA/>` pass on object count / a quality flag; small models
keep it, large models may drop to MSAA (`gl={{antialias:true}}`) or none.
Final knob values are tuned in Phase 01 against both fixtures.

## D-5 — Incremental per-lens migration, not big-bang — **Accepted**

Migrate the **building lens first** (Phase 03), then the remaining mesh lenses
(Phase 04), accepting a temporary dual code path (batched building + per-mesh
others). Rationale: the building lens is the default + worst case, so it
proves the architecture on the highest-value surface and each phase stays
independently reviewable and shippable. The dual path is explicitly temporary
— Phase 04 removes the per-mesh path for mesh lenses. (No users / no deploy
means we are not forced into this, but reviewability still favors it.)

## D-6 — Lines (ducts/pipes) stay per-object — **Accepted (measured, Phase 04b)**

Duct/pipe segments are a few hundred at most and only on two lenses. They stay
as per-object drei `<Line>` initially. Phase 04 measures the ventilation /
hot-water lenses; only if they miss §7 targets do we merge lines into a single
`LineSegments2`. Recorded so the omission is intentional, not forgotten (the
review's "no silent caps" principle).

**Outcome (2026-06-18, Phase 04b — measured on Hillandale).** Ventilation is the
worst case: **227 duct segments → ~240 draw calls**, yet the settled frame is
**16.7 ms (~60 FPS)** — each thin `Line2` draw is cheap. So the lines lens
**misses the A1 draw-call proxy (≤ ~50) but meets the real A2 interaction target
(≥ 45 FPS)**, which is the goal the proxy stands in for. Hot-water (117 pipes) is
lighter still. **Decision: leave lines per-object.** Merging into one
`LineSegments2` would need a per-segment `batchId`→id map (hover/select), dashed
`pipe-recirc` support, and `worldUnits` width — real complexity that buys
draw-call count but no perceptible smoothness on a lens already at 60 FPS.
**Revisit** only if a real model's line lenses actually drop frames.

## D-7 — Shade groups merged per `display_name` — **Accepted**

Restore the original PRD §7 / V1 intent: shades merge into one mesh per
`display_name` group (currently one mesh per shade, F9). Folded into Phase 04
(site-sun lens). Low object count, but it removes an anti-pattern and matches
the documented design.

## D-8 — Keep `frameloop="demand"` — **Accepted**

The demand loop is correct and keeps the viewer idle-cheap; the lag is purely
in interaction frames. Preserve it. Phase 04 fixes the lens-fade so it does
not force a full React reconcile every frame during the transition (F8) — the
fade becomes an imperative opacity tween, not `setState` per frame.

## D-9 — Picking & highlight on BatchedMesh (resolves the V1-selection question) — **Accepted (API verified)**

V1's per-face selection (raycast → `intersect.object` is the face mesh → swap
that mesh's `.material`; `selectFaceVertex.tsx` reads `geometry.position` by
`faceIndex`) depends on one mesh **per face** and does not literally port to a
single BatchedMesh. The **capabilities** port cleanly via BatchedMesh's
per-instance API, **verified in the installed `three@0.184.0` source**
(`node_modules/.pnpm/three@0.184.0/node_modules/three/src/objects/BatchedMesh.js`):

| V1 capability | V1 mechanism | BatchedMesh replacement | Source |
|---|---|---|---|
| which object was hit | `intersect.object` | raycast sets `intersect.batchId` on each hit | `raycast()` line ~1428 |
| highlight / recolor it | swap `.material` + `userData.materialStore` | `setColorAt(batchId, c)` / `getColorAt` | lines 1108 / 1132 |
| restore on deselect | restore `materialStore` | write the object's themed color back | — |
| space-group highlight | walk parent `spaceGroup` | `spaceId → batchId[]`, `setColorAt` each | — |
| future hide-category | (n/a) | `setVisibleAt(batchId, false)` | line 1162 |
| measure vertex snap | `selectFaceVertex.tsx` raycast `faceIndex` | **unchanged** — V2 snaps `meta.vertices` by screen-projection (`lib/measure.ts`), independent of scene mesh structure | — |

**Picking design.** Build `batchId ↔ ModelObjectId` maps at `addGeometry` time
(per lens batch). A single imperative controller subscribes to the store's
`selectionId` / `hoverId` and applies highlight via `setColorAt` (old id →
themed color, new id → highlight). This **resolves F6**: the store keeps the
ids (inspector/camera stay React-driven), but only one subscriber applies them
— not 7,200 per-object subscriptions. Pointer-move picking mirrors
`MeasureOverlay`'s existing rAF-throttled imperative raycast (read `batchId`
off the intersection). `selectMesh.tsx`-equivalent shrinks to "raycast one
mesh, read `batchId`"; `selectObject.tsx`-equivalent becomes `setColorAt`;
`selectFaceVertex.tsx`-equivalent is dropped (already unused in V2).

This is detailed in Phase 03 (building lens) and generalized in Phase 04.
