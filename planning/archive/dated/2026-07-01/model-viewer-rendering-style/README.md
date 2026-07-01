---
DATE: 2026-07-01
TIME: 00:55 EDT
STATUS: Complete — merged to main via PR #26 (2c533d4b)
AUTHOR: Ed May / Claude
SCOPE: 3D model-viewer scene rendering — legibility, outlines, lighting, shadows
RELATED:
  - frontend/src/features/model_viewer/scene/ViewerCanvas.tsx
  - frontend/src/features/model_viewer/scene/LensBatch.ts
  - frontend/src/features/model_viewer/lib/colors.ts
  - context/ui/pages/ (model viewer page docs)
---

# Model-Viewer Rendering Style — Research & Refactor

Cross-cutting refactor of how the 3D model viewer renders its scene. Goal:
improve **legibility** and make the scene **feel alive / solid** by matching
techniques from successful precedent products, rather than inventing a look
whole-cloth.

This is a **research-first** effort. Phase 1 is collecting and reverse-
engineering precedent; implementation scope comes after we agree on a target
look.

## Read order

1. `STATUS.md` — **start here**: what's done, where we are, what's left, and the
   resume recipe (worktree, stack, harness commands).
2. `research.md` — current-state baseline, precedent analysis, the techniques we
   want to borrow, and the captured perf baseline (§7.1).
3. `target-spec.md` — the concrete R3F knob plan (AO → soft IBL → tone mapping →
   lightened edges) with params + promotion criteria.
4. `assets/precedent/` — collected reference screenshots (**gitignored**,
   third-party/copyright; local only). Organized one subfolder per product.

## Scope

- **In scope (now):** default scene lighting, shadows, surface shading,
  outlines/edges, overall "material model" feel, and legibility of the
  color-by themes against that backdrop.
- **Future (noted, not now):** user-controlled solar position — scrub
  date/time, sun moves, real cast shadows update (a design-analysis feature).
  The default-lighting work should not foreclose this.
- **Out of scope:** the data model, lens/batch architecture changes beyond
  what a look change requires, picking/selection behavior.

## Hard constraints the look must respect

- **Substrate:** each lens is ≤2 `BatchedMesh` draw calls (opaque +
  transparent) + 1 merged edge `LineSegments`; per-object color is the
  per-instance color buffer (`setColorAt`), not material color. A new look
  must work within this or justify breaking it.
- **`frameloop="demand"`:** the viewer only renders on interaction. Anything
  per-frame (e.g. real-time shadow updates) fights this and needs a deliberate
  decision.
- **Heavy models:** Hillandale ~7,200 objects. Techniques must stay viable at
  that scale (see the MSAA-vs-SMAA threshold already in `ViewerCanvas.tsx`).
- **Public repo / no licensed data** — precedent screenshots stay gitignored.

## Status

Complete. The "solid study-model" look (soft key+fill lighting + N8AO + neutral
near-white palette + dark opaque windows + flat unlit highlight + lightened
edges) ships as the default. Merged to `main` 2026-07-01 via PR #26 (`2c533d4b`);
CI green. See `STATUS.md` for the full history.
