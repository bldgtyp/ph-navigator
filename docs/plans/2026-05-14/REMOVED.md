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

### `context/DATA_TABLE.md`

Removed from active top-level context 2026-05-12.

Reason: the file was mostly a consolidated catalog-POC/table-view
record. Current table requirements now belong in the technical
requirements layer, while user-facing interaction details and story
acceptance criteria belong in the UI/UX and user-story docs.

Current source of truth:
`context/technical-requirements/data-table.md`,
`context/UI_UX.md` §1.7, and
`context/user-stories/30-tables-equipment.md`.

Historical sources remain under `research/poc-plans/` and
`research/poc-sandbox/`.

## Relocated Stable Docs

These are still active, but moved out of `docs/plans/` and into
`context/`:

| Old path | New path |
|---|---|
| `docs/plans/architecture-prd.md` | `context/PRD.md` |
| `docs/plans/tech-stack.md` | `context/TECH_STACK.md` |
| `docs/plans/table-view.md` | Removed 2026-05-12; current contract in `context/technical-requirements/data-table.md` |
| `docs/plans/ui-ux.md` | `context/UI_UX.md` |
| `docs/plans/user-stories.md` | `context/USER_STORIES.md` |
| `context/UBIQUITOUS_LANGUAGE.md` | `context/GLOSSARY.md` |
