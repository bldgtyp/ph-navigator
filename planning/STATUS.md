# Planning Status

DATE: 2026-06-16
TIME: 13:05 EDT
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
| Spaces Refactor | Active / Phase 04 complete; Phase 05 verification, browser smoke, and context closeout next | `features/spaces-refactor/STATUS.md` |

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
- Completed Attachments (v1) planning now lives under
  `archive/attachments/`. The stable implementation contract remains
  current in `context/technical-requirements/attachments.md`; the
  deferred v1.1 candidate stays in
  `planning/features_v1.1/user-defined-attachment-fields/`.

## Update Rule

When a feature phase lands, update the feature `STATUS.md` first, then
fold durable decisions into `PRD.md`, `decisions.md`, or `context/`.
