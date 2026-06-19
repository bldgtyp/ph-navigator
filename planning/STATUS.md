# Planning Status

DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Active routing index for tracked planning material.
AUTHOR: Codex
SCOPE: Current planning folder organization after moving dated docs to
feature-first planning.

## Active / Current Feature Folders

| Feature | State | Current pointer |
|---|---|---|
| Delete Project | In review | `features/delete-project/STATUS.md` |
| DataTable Color Field | Complete / implemented on main with CI and browser smoke evidence | `features/color-field/STATUS.md` |
| Attachments | Complete (v1) / implemented on main with automated coverage, R2 smoke, and full Render staging acceptance; Phase-5 polish deferred by decision; archived | `archive/attachments/STATUS.md` |
| IP/SI Unit Switching | Planned / implementation plan drafted | `features/ip-si-unit-switching/STATUS.md` |
| Apertures / Aperture Builder | Planned / PRD updated with review decisions; phase planning not started | `features/apertures/STATUS.md` |
| CSS Token Guard Sweep | Complete / implemented on main worktree with format + CI evidence; archived | `archive/css-token-guard-sweep/STATUS.md` |
| Heat Pump Link Fields | Complete / implemented on main with format, CI, graphify update, browser smoke evidence; archived | `archive/heat-pump-link-fields/STATUS.md` |
| Spaces Refactor | Complete / Phase 05 verified with format, CI, browser smoke, graphify, simplify, and docs-pass evidence; archived | `archive/spaces-refactor/STATUS.md` |
| DataTable Consolidation | Complete / Phase 06 verified with format, CI, browser smoke, graphify, simplify, and docs-pass evidence; archived | `archive/data-table-consolidation/STATUS.md` |
| DataTable Maintenance | Complete / cleanup follow-up implemented and archived | `archive/data-table-maintenance/STATUS.md` |
| DataTable Regression Suite | Planned / docs-only packet recorded; implementation intentionally not started | `features/data-table-regression-suite/STATUS.md` |

## Historical Material

- Legacy dated planning files now live under `archive/dated/<date>/...`.
- Dated code reviews now live under `code-reviews/<date>/...`.
- Feature-specific dated bundles now live under `features/<feature>/...`.
- Completed Assembly Builder canvas-refactor planning now lives under
  `archive/assembly-builder/`; older foundation precedent remains
  under `archive/assembly-builder-foundation/`.
- Completed CSS Token Guard Sweep planning now lives under
  `archive/css-token-guard-sweep/`.
- Completed Heat Pump Link Fields planning now lives under
  `archive/heat-pump-link-fields/`.
- Completed Spaces Refactor planning now lives under
  `archive/spaces-refactor/`.
- Completed DataTable Consolidation planning now lives under
  `archive/data-table-consolidation/`.
- Completed DataTable Maintenance cleanup now lives under
  `archive/data-table-maintenance/`.
- Active DataTable Regression Suite planning now lives under
  `features/data-table-regression-suite/`.
- Completed Attachments (v1) planning now lives under
  `archive/attachments/`. The stable implementation contract remains
  current in `context/technical-requirements/attachments.md`; the
  deferred v1.1 candidate stays in
  `planning/features_v1.1/user-defined-attachment-fields/`.
- Completed Model-Viewer rendering-performance refactor now lives under
  `archive/model-viewer-performance/` (Phases 00–05; Hillandale building
  lens 14 draw calls @ 60 FPS, was 32,045 @ 0.4). The reusable substrate
  convention is in `frontend/src/features/model_viewer/scene/{LensBatch,
  BatchedLens}`. Optional follow-ups (true cross-fade, line merging, the
  OQ-3 opaque-shell look review) are recorded in that folder's `STATUS.md`
  "Next step"; model-viewer feature backlog stays under
  `planning/features_v1.1/model-viewer-*`.

## Update Rule

When a feature phase lands, update the feature `STATUS.md` first, then
fold durable decisions into `PRD.md`, `decisions.md`, or `context/`.
