---
DATE: 2026-08-20
TIME: 07:21 EDT
STATUS: Complete — all phases accepted
AUTHOR: Codex
SCOPE: Current state of Model Viewer shading-factor mode
RELATED:
  - planning/features/model-viewer-shading-factor/PRD.md
  - planning/features/model-viewer-shading-factor/PLAN.md
---

# STATUS — Model Viewer Shading Factor

**State:** `Complete`; Phases 00–04 accepted. Archive cleanup is next.

## Next step

Archive this completed packet under the dated planning archive and update its
index/references.

## Known constraint

This is forward-only for existing immutable `/model_data` artifacts. The viewer
must show Missing for old artifacts. Re-extraction of production models is a
separate, explicitly authorized operation.

## Verification ledger

- [x] Backend valid/null/invalid factor extraction tests.
- [x] Legacy artifact compatibility.
- [x] Type/meta carry-through tests.
- [x] Fixed continuous-scale unit tests.
- [x] Building-only theme registration and URL season parsing.
- [x] Summer/Winter repaint without geometry/network work.
- [x] Continuous legend and Missing count.
- [x] Inspector values.
- [x] Viewer structural draw-call performance gate and mounted renderer-stability check.
- [x] Mounted fresh-artifact browser acceptance after agent readiness.
- [x] Graphify and durable Model Viewer docs update.

## Blockers

None for implementation. Existing production artifacts will remain Missing
until a separate rebuild/re-upload decision is made.

## Phase ledger

- [x] Phase 00 — source and artifact characterization. Focused extraction run:
  `1 passed, 2 xfailed`; expected failures lock the Phase 01 wire contract.
- [x] Phase 01 — backend extraction. Focused extraction and route artifact
  coverage verifies valid/null/absent/invalid factors plus bounded aggregate
  warnings.
- [x] Phase 02 — color engine and meta carry-through. Fixed-scale and loader
  metadata tests pin the seasonal source values and sRGB output.
- [x] Phase 03 — theme, season, legend, and inspector. Focused Vitest coverage
  verifies theme registration, seasonal color selection, continuous legend,
  control visibility/state, and dual-value inspector formatting (`40 passed`).
- [x] Phase 04 — render/performance acceptance. Structural perf coverage keeps
  a 4,500-object lens at no more than two batched meshes plus one edge line.
  Mounted acceptance used a freshly extracted mixed-factor artifact and
  verified exact Summer/Winter colors, Missing count, inspector values,
  Building-only registration, zero season-switch model requests, stable object
  IDs/renderer calls/geometries, URL reload, and no authenticated viewer console
  errors. Full CI: backend `1907 passed, 7 skipped`; frontend `2517 passed`;
  production build passed. `graphify update .` completed.
