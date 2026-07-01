---
DATE: 2026-07-01
TIME: 18:05
STATUS: Active — implementation sequence for the reviewed PRD.
AUTHOR: Claude (for Ed)
SCOPE: High-level implementation sequence for the model-viewer sun-study
  feature. Behavior contract lives in PRD.md; per-phase details live in
  phases/.
RELATED:
  - PRD.md, STATUS.md, README.md (this folder)
  - phases/phase-01-ground-shadow-baseline.md
  - phases/phase-02-shadow-spike.md
  - phases/phase-03-backend-solar-grid.md
  - phases/phase-04-scene-sun-light.md
  - phases/phase-05-sun-bar-ui.md
  - phases/phase-06-verification-closeout.md
  - ../model-viewer-ground-shadows/ (Superseded — imported as phase 01)
---

# Plan — Model Viewer Sun Study

Six phases, strictly ordered. Phases 01–02 de-risk rendering before any
product code; 03 is backend-only; 04–05 are the feature; 06 is the
verification + closeout gate. Each phase ends green on its own gate so
the branch is always mergeable at a phase boundary.

| Phase | What | Gate |
|---|---|---|
| 01 | Ground-shadow baseline fix (imported D-12 packet): correct the `ContactShadows` vertical-plane artifact in `ViewerCanvas.tsx` | Browser smoke across lenses + section; `make frontend-dev-check` |
| 02 | Spike: BatchedMesh × shadow maps (`castShadow`/`receiveShadow` on the ≤2 substrate batches, `ShadowMaterial` catcher, `Canvas shadows` flag cost, `clipShadows`) | Findings recorded in the phase doc; go/no-go for D-3/D-4 as specced |
| 03 | Backend solar-position grid: `SunPositionGridSchema` (365×24 unit vectors + per-day sunrise/sunset) on `/sun-path`, same `Sunpath` instance as the dome | Golden + frame-consistency + payload tests; `uv run pytest` green |
| 04 | Scene: store slice, grid interpolation hook, sun marker, key-light re-aim + shadows while engaged, shadow catcher, horizon ramp, engage/disengage lifecycle, debug hook | Unit tests (interp/ramp/marker); browser verification of shadows moving |
| 05 | Sun bar UI: collapsed pill → expanded bar (date scrubber + 4 chips, time scrubber with daylight band, header readout, details row), Esc/lens-switch behavior, polish pass | Browser verification incl. narrow viewport; keyboard operability |
| 06 | Tests + perf verification + closeout: e2e extension, perf-gate additions, heavy-fixture perf check, Q-VIEW-6 docs amend, simplify/docs-pass, `make ci` | All PRD §12 acceptance criteria; `make ci` green |

## Working agreements

- Branch: `feature/model-viewer-sun-study` off `main`; merge only when
  phase 06 is green (main deploys production).
- Every phase updates `STATUS.md` (state + verification evidence) when
  it lands.
- Perf ledger entries (before/after draw calls + frame times) live in
  the phase docs; screenshots under `assets/`.
