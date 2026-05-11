---
DATE: 2026-05-11
TIME: -
STATUS: Active routing note
AUTHOR: Codex
SCOPE: Documents removed from the active PH-Navigator V2 context path.
---

# Removed / Archived Planning Docs

This file is the routing layer for material intentionally removed from
the active planning context. Do not load these as current direction.
Use them only for archaeology.

## Removed From Active Context

### `docs/plans/project-versioning-predecessor.md`

Removed 2026-05-11.

Reason: superseded by `context/PRD.md`. The predecessor was useful for
working through autosave, lifecycle states, named snapshots, and
catalog pinning, but its recommended model is no longer current. V2 now
uses explicit Save / Save As against named `project_versions`, with
drafts as crash-recovery buffers and no single project-level lifecycle
state.

Current source of truth: `context/PRD.md` §8.

### `docs/plans/2026-05-11/draft-save-state-machine.md`

Removed as a standalone doc 2026-05-11.

Reason: accepted draft/save decisions were folded into the canonical
PRD so the save model is not split across peer documents.

Current source of truth: `context/PRD.md` §§8.3-8.6 and §9.5.

## Relocated Stable Docs

These are still active, but moved out of `docs/plans/` and into
`context/`:

| Old path | New path |
|---|---|
| `docs/plans/architecture-prd.md` | `context/PRD.md` |
| `docs/plans/tech-stack.md` | `context/TECH_STACK.md` |
| `docs/plans/table-view.md` | `context/DATA_TABLE.md` |
| `docs/plans/ui-ux.md` | `context/UI_UX.md` |
| `docs/plans/user-stories.md` | `context/USER_STORIES.md` |
| `context/UBIQUITOUS_LANGUAGE.md` | `context/GLOSSARY.md` |
