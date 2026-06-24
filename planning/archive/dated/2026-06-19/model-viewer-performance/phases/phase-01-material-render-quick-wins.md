---
DATE: 2026-06-18
TIME: -
STATUS: Done
AUTHOR: Claude (Opus 4.8)
SCOPE: Phase 01 — the substrate-agnostic quick wins that reproduce V1's
       render technique. Keeps the per-mesh structure; fixes materials, passes,
       DPR. This is the D-1 re-measure checkpoint.
RELATED: ../PRD.md §4/§7, ../decisions.md D-2/D-4, review F1/F2/F4/F7
RESOLVES: F1 (per-mesh clone), F2 (all-transparent), F4 (double shadows),
          F7 (dpr/post-FX)
DEPENDS ON: Phase 00 (baseline numbers)
OUTCOME: ~2× fewer draw calls and ~2.4× faster frames, but still O(faces) and
         far from §7 targets. OQ-1 answered: Phase 03 (BatchedMesh) is required,
         NOT descopable. Two human-review items remain (see "Pending sign-off").
---

# Phase 01 — Material & render-pipeline quick wins

## Goal

Reproduce the V1 render technique that ran this exact model acceptably:
**shared opaque materials, one shadow pass, minimal post-FX, capped DPR** —
without changing the per-mesh structure or committing to D-1. This is expected
to deliver most of the felt improvement and is the **decision checkpoint**: we
re-measure on Hillandale before building BatchedMesh (OQ-1).

## Background (why these four, from the V1 read)

V1 `Materials.tsx` shares one instance of each material and `load_faces.tsx`
assigns the shared `geometryStandard` (opaque) to every face; selection swaps
the shared reference. V1 `SceneSetup.tsx` runs only a `RenderPass` (SAO
disabled), one directional shadow + a `ShadowMaterial` ground receiver, and
caps pixel ratio at `min(dpr,2)`. V2 regressed all four. We undo the
regressions.

## In scope

### F1 — Stop cloning materials per mesh
- **`scene/useOpacityMaterial.ts`**: today every `MeshObject` calls
  `material.clone()` → ~7,200 unique materials. Remove per-object cloning.
  - Steady state (active lens, opacity ≈ 1): pass the **shared** palette
    material straight through (no clone).
  - The 0.18 s lens cross-fade is the only reason a per-object opacity exists.
    Handle it without per-mesh clones: fade the **layer** via a small set of
    shared transparent "fade" materials (one per base material, opacity driven
    once per frame on the shared instance), or defer fade handling to Phase 04
    (D-8) and accept a hard lens switch in the interim. Pick the lower-risk
    option during implementation and note it.
- Net: building-lens live material count drops from O(faces) to O(theme
  buckets) (A3).

### F2 — Opaque shell
- **`lib/colors.ts` `materialFor`/`baseOpacity`**: today **all** types are
  `transparent: true` (faces at 0.94). Make `faceMesh` (and
  `spaceFloorSegmentMeshFace` when fully shown) **opaque** (`transparent:false`,
  `opacity:1`). Keep transparency only where semantic: apertures (glass 0.68),
  space volumes (0.32), ghost (0.03).
- Re-derive `depthWrite` accordingly (opaque writes depth; transparent does
  not). This re-enables early-Z + removes the per-frame transparent sort of
  thousands of objects — the dominant cost.
- **R5 / OQ-3:** this is a visible change (opaque vs faintly translucent
  shell). Capture a screenshot pair and confirm acceptability with Ed.

### F4 — One shadow strategy (D-2)
- **`scene/ViewerCanvas.tsx`**: today `shadows` + `directionalLight castShadow`
  **and** `<ContactShadows>` (default `frames=Infinity`, re-renders scene every
  frame). Keep **one**:
  - Set `<ContactShadows frames={1} />` (bake once; re-bake on model/lens
    change), and drop the directional `castShadow` (and per-mesh
    `castShadow/receiveShadow` in `BuildingLens.tsx` if the directional map is
    gone) — **or** keep the directional map and drop ContactShadows. Choose by
    side-by-side look; default to baked ContactShadows (cheaper, V1-like).
- Add a guard hook for "shadows off above N objects" if needed (tune in
  testing).

### F7 — DPR + post-FX (D-4)
- **`scene/ViewerCanvas.tsx`**: set `<Canvas dpr={[1, 1.5]}>` (optionally
  `<AdaptiveDpr>` to drop DPR during orbit). Gate `<EffectComposer><SMAA/>` on
  object count / a quality flag; large models may use MSAA
  (`gl={{antialias:true}}`) or no post-FX. Tune knobs against both fixtures so
  the small model keeps its current crispness.

## Out of scope

- No geometry merging / batching (Phases 02–04).
- No change to picking/selection mechanism (still per-mesh R3F handlers here).
- `<Edges>`-per-mesh stays for now (folded into the merge in Phase 03);
  optionally note its cost in the Phase-01 numbers.

## What shipped

- **F1 — no per-object material clone.** Deleted `scene/useOpacityMaterial.ts`
  entirely; `MeshObject` now passes the **shared** palette/theme material
  straight through. Live material count for the building lens is now
  O(theme buckets), not O(faces) (A3 met). This removed ~14,400 unique
  materials + their per-object dispose effects on Hillandale.
- **F1 (fade) — hard lens switch for now.** The per-object opacity that the
  0.18 s cross-fade needed was the *only* reason for the clone, so the
  cross-fade machinery (`useLensFade`, the two-layer render, the per-frame
  `setTick`/`invalidate` reconcile) was removed. Lens switches are an instant
  cut in the interim. **Phase 04 (D-8) restores the fade as an imperative
  opacity tween** that does not reconcile React every frame (this also pre-pays
  part of F8). Chosen as the lower-risk option per the phase plan.
- **F2 — opaque shell.** `lib/colors.ts` `materialFor` now derives
  `transparent`/`depthWrite` from `opacity < 1`. `faceMesh` and
  `spaceFloorSegmentMeshFace` are opaque (`opacity 1`, depth-writing);
  apertures (0.68) and space volumes (0.32) stay translucent. This re-enables
  early-Z and removes the per-frame transparent sort of thousands of faces.
  (Theme/color-by mode was already opaque `MeshBasicMaterial` — unaffected.)
- **F4 — one shadow strategy.** `ViewerCanvas` dropped the Canvas `shadows`
  flag + the directional `castShadow` + per-mesh `castShadow/receiveShadow`,
  keeping a single baked `<ContactShadows frames={1}>` ground blob. It is keyed
  on the active lens so it re-bakes when the visible geometry changes.
- **F7 — DPR + post-FX.** `<Canvas dpr={[1, 1.5]}>`. Post-FX is gated on
  object count (`LARGE_MODEL_OBJECT_THRESHOLD = 1500`): light models (small
  fixture) keep `<EffectComposer><SMAA/>` with `antialias:false`; heavy models
  (Hillandale) drop the SMAA pass and use hardware MSAA (`gl.antialias:true`).
  The Canvas is keyed by file in `ModelViewerStage`, so the AA choice is fixed
  per model and re-initializes correctly on file swap.

## Measured result — OQ-1 ANSWERED

Re-measured on Hillandale (same harness/device as Phase 00, headless Chromium).
Draw calls are the structural signal; frame time on this rAF-driven orbit is
driver-influenced (see Phase-00 note) but the relative improvement is real.

| Lens | Calls (00 → 01) | ms/frame (00 → 01) | FPS (00 → 01) |
|---|---|---|---|
| building | 32,045 → **14,415** | 2,297 → **966** | 0.4 → **1.1** |
| spaces | 61,785 → **33,728** | 3,627 → **1,682** | 0.3 → **0.6** |
| floor-areas | 35,752 → **18,972** | 2,619 → **1,177** | 0.4 → **0.9** |
| site-sun | 32,055 → **17,558** | 2,268 → **1,011** | 0.4 → **1.0** |
| ventilation | 32,467 → **17,831** | 2,198 → **998** | 0.5 → **1.0** |
| hot-water | 32,214 → **17,688** | 1,969 → **989** | 0.5 → **1.0** |

Draw calls ≈ halved, frame time ≈ 2.4× faster, FPS ≈ tripled. **But the
building lens is still 14,415 calls ≈ 2 × 7,202 faces** (one `<mesh>` + one
`<Edges>` each) — fundamentally O(faces), and 1.1 FPS is nowhere near the §7
targets (A1 ≤ ~50 calls, A2 ≥ 45 FPS).

**OQ-1 → NO.** Phase 01 alone does not meet §7 targets. **Phase 03's
BatchedMesh substrate is required and CANNOT be descoped.** The per-face mesh +
per-face edge + per-object Zustand subscriptions (F6) are the remaining cost and
are exactly what Phase 02 (merge) + Phase 03 (batch) remove. Raw data:
`working/perf-phase01.json` (Phase-00 preserved at
`working/perf-baseline-phase00.json`).

## Pending sign-off (human review — cannot be completed autonomously)

- **OQ-3 / R5 — opaque shell look.** Faces are now fully opaque instead of
  0.94-translucent. "After" screenshot captured at
  `working/phase01-opaque-shell.png` (Hillandale, building lens, shaded). Ed to
  confirm acceptable; trivially reverted per-type in `baseOpacity` if not.
- **Shadow look.** ContactShadows-only (no directional map) is the D-2 default;
  confirm the ground-contact cue reads well on Hillandale.

## Risks & mitigations

- **R5 opaque look change** — confirm with Ed (OQ-3); easily reverted per-type.
- **Fade regression** — if sharing materials breaks the cross-fade, fall back
  to a hard switch and let Phase 04 (D-8) restore the fade imperatively; note
  it in STATUS.
- **Transparent ordering for glass** — unchanged from V1 behavior (windows
  were always transparent); acceptable.

## Verification

- `make format` + `make ci` green.
- **Re-measure (the point of this phase):** Hillandale building-lens
  `render.calls` and orbit FPS vs Phase-00 baseline. Record in STATUS.
- Focused frontend test if any parsing/state touched:
  `cd frontend && pnpm exec vitest run` on affected files; existing
  `viewerThemes`/`viewerCore` tests stay green.
- Playwright MCP parity on both fixtures: lenses, themes, select/hover,
  measure, legend.
- Screenshot pair (before/after opaque shell) attached to `assets/` or
  `working/` for the R5 sign-off.

## Exit criteria

- [x] No per-object material clone; live materials O(theme buckets) (A3).
- [x] Faces opaque; transparency only where semantic. _Ed sign-off (OQ-3) still
      pending — screenshot captured; see "Pending sign-off"._
- [x] Single shadow strategy; no per-frame second shadow pass.
- [x] DPR capped; post-FX gated.
- [x] Re-measured on Hillandale; OQ-1 answered (**no** — Phase 03 required) and
      recorded so Phase 03 scope is decided on evidence.
