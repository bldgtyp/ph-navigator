# Planning Status

DATE: 2026-06-14
TIME: 15:50 EDT
STATUS: Active routing index for tracked planning material.
AUTHOR: Codex
SCOPE: Current planning folder organization after moving dated docs to
feature-first planning.

## Active / Current Feature Folders

| Feature | State | Current pointer |
|---|---|---|
| Delete Project | In review | `features/delete-project/STATUS.md` |
| DataTable Color Field | Complete / implemented on main with CI and browser smoke evidence | `features/color-field/STATUS.md` |
| Attachments | In review / partially implemented on main; full acceptance still open | `features/attachments/STATUS.md` |
| IP/SI Unit Switching | Planned / implementation plan drafted | `features/ip-si-unit-switching/STATUS.md` |
| Apertures / Aperture Builder | Planned / PRD updated with review decisions; phase planning not started | `features/apertures/STATUS.md` |
| CSS Token Guard Sweep | Complete / implemented on main worktree with format + CI evidence; archived | `archive/css-token-guard-sweep/STATUS.md` |

## Historical Material

- Legacy dated planning files now live under `archive/dated/<date>/...`.
- Dated code reviews now live under `code-reviews/<date>/...`.
- Feature-specific dated bundles now live under `features/<feature>/...`.
- Completed Assembly Builder canvas-refactor planning now lives under
  `archive/assembly-builder/`; older foundation precedent remains
  under `archive/assembly-builder-foundation/`.
- Completed CSS Token Guard Sweep planning now lives under
  `archive/css-token-guard-sweep/`.

## Update Rule

When a feature phase lands, update the feature `STATUS.md` first, then
fold durable decisions into `PRD.md`, `decisions.md`, or `context/`.
