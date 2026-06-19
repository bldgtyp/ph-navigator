---
DATE: 2026-06-18
TIME: -
STATUS: Complete
AUTHOR: Claude (Opus 4.8)
SCOPE: Router for the model-viewer rendering-performance refactor. Read this
       first; it gives reading order, the phase map, and where state lives.
       Complete (2026-06-18): Hillandale building lens 14 draw calls @ 60 FPS
       (was 32,045 @ 0.4); see STATUS.md.
RELATED:
  - planning/code-reviews/2026-06-18/model-viewer-large-model-performance.md
    (the review that triggered this refactor — findings F1–F9)
  - planning/archive/model-viewer-performance/PRD.md
  - planning/archive/model-viewer-performance/PLAN.md
  - planning/archive/model-viewer-performance/STATUS.md
  - planning/archive/model-viewer-performance/decisions.md
  - planning/archive/model-viewer/PRD.md (§7 perf posture — the original intent)
  - research/v1-3d-model-viewer-reference.md (V1 behavior catalog)
  - frontend/src/features/model_viewer/** (the code under refactor)
---

# Model Viewer — Rendering Performance Refactor

## Why this exists

The V2 R3F model viewer is smooth on small models but degrades badly on
large multifamily models (the Hillandale fixture: 583 rooms / 6,178 faces /
1,024 apertures). The 2026-06-18 code review traced this to a stack of
compounding regressions (findings **F1–F9**): per-mesh material **cloning**,
**all-transparent** materials, **one `<mesh>` + one `<Edges>` per face** (no
batching), **two** shadow passes, a per-non-building-lens **ghost re-render**
of the whole building, and **per-object React/Zustand** subscriptions.

V1 ran this same model acceptably without any batching — purely by sharing
opaque materials, running minimal passes, and keeping the scene **imperative
(non-R3F)** so it never paid per-face React cost. This refactor restores that
performance and then exceeds it, while keeping V2's R3F architecture and
making the code cleaner and more extensible than either version.

We have **no users and no public deploy**, so this is a free-hand refactor:
we change whatever makes the code cleanest, not the minimum diff.

## The decision already taken

The dense building geometry will render as a **single `THREE.BatchedMesh`
per lens** (driven imperatively via an R3F `<primitive>`), with per-object
color / visibility / picking as first-class operations. This reproduces V1's
"one shared geometry object, raycast it, recolor the hit" model inside R3F,
and improves on it (per-instance color buffer for color-by; built-in
per-object visibility for future toggles). Rationale, the rejected
merged-vertex-color alternative, and the Phase-3 fallback are in
[`decisions.md`](./decisions.md) (**D-1**).

## Read order

1. [`PRD.md`](./PRD.md) — goals, non-goals, target architecture, acceptance.
2. [`decisions.md`](./decisions.md) — substrate choice + rejected options.
3. [`PLAN.md`](./PLAN.md) — phase sequence and dependency graph.
4. [`STATUS.md`](./STATUS.md) — current state, next step, blockers.
5. `phases/phase-NN-*.md` — the per-phase implementation plans.

## Phase map

| Phase | Title | Resolves | Substrate-agnostic? | Shippable alone? |
|---|---|---|---|---|
| 00 | Perf harness & baseline | (measurement) | yes | yes |
| 01 | Material & render-pipeline quick wins | F1, F2, F4, F7 | yes | yes — ≈ V1 parity |
| 02 | Ghost consolidation + merge utilities | F5 | yes | yes |
| 03 | BatchedMesh substrate + building lens | F3, F6 (+ theming) | **no — locks D-1** | yes |
| 04 | Migrate remaining lenses + lines + fade | F8, F9 | no | yes |
| 05 | Hardening, perf gate, docs fold-back | (regression lock) | n/a | yes |

Each phase has its own STATUS line in [`STATUS.md`](./STATUS.md). Phases 00–02
deliver most of the felt improvement and do not commit us to the substrate;
the BatchedMesh bet is isolated to Phase 03 behind a go/no-go gate.

## Verification spine (every phase)

- `make ci` green (the mandatory closeout gate).
- Playwright MCP walkthrough on **both** fixtures
  (`ph_nav_v2_example.hbjson` small, `Hillandale_Gateway_NAR_260402.hbjson`
  large) — see `planning/archive/model-viewer/AGENT_BROWSER_NOTES.md`.
- The Phase-00 perf overlay: `renderer.info.render.calls` (draw calls) and
  frame time, recorded before/after, on Hillandale.
- No regression against `research/v1-3d-model-viewer-reference.md` §16 and
  the original viewer `UI_SPEC.md` interactions.
