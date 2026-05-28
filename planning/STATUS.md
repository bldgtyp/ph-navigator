# Planning Status

DATE: 2026-05-27
TIME: 00:00 EDT
STATUS: Active routing index for tracked planning material.
AUTHOR: Codex
SCOPE: Current planning folder organization after moving dated docs to
feature-first planning.

## Active / Current Feature Folders

| Feature | State | Current pointer |
|---|---|---|
| Assembly Builder | UI parity Phase 15 implemented / review next | `features/assembly-builder/STATUS.md` |
| Editable Fields | Active / typecheck fixture migration in progress | `features/editable-fields/STATUS.md` |
| Delete Project | In review | `features/delete-project/STATUS.md` |
| Attachments | Planned / PRD and phase plans drafted | `features/attachments/STATUS.md` |
| IP/SI Unit Switching | Planned / implementation plan drafted | `features/ip-si-unit-switching/STATUS.md` |

## Historical Material

- Legacy dated planning files now live under `archive/dated/<date>/...`.
- Dated code reviews now live under `code-reviews/<date>/...`.
- Feature-specific dated bundles now live under `features/<feature>/...`.

## Update Rule

When a feature phase lands, update the feature `STATUS.md` first, then
fold durable decisions into `PRD.md`, `decisions.md`, or `context/`.
