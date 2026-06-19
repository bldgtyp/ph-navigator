---
DATE: 2026-06-17
TIME: 14:40 EDT
STATUS: Phase 00 implemented
AUTHOR: Ed (via Codex)
SCOPE: Follow-up cleanup items extracted from the completed DataTable
  consolidation refactor.
RELATED:
  - planning/features/data-table-maintenance/STATUS.md
  - planning/features/data-table-maintenance/PRD.md
  - planning/features/data-table-maintenance/phases/phase-00-cleanup-outline.md
  - planning/archive/data-table-consolidation/STATUS.md
---

# DataTable Maintenance - Feature Folder

## Scope

Track small cleanup slices that improve the shared DataTable system after
the DataTable consolidation refactor shipped.

This folder exists because the consolidation packet is complete and
archived, but it carried two non-blocking cleanup items that should stay
discoverable:

- split the remaining oversized Heat Pump frontend files carrying
  structural guard exceptions;
- extract the backend `validate_document_references` god method into
  narrower validators without changing behavior.

## Read Order

1. `STATUS.md` - current state, next step, blockers.
2. `PRD.md` - cleanup goals and non-goals.
3. `phases/phase-00-cleanup-outline.md` - implementation outline.

## Out Of Scope

- No DataTable behavior redesign.
- No compatibility shims for pre-consolidation table shapes.
- No unrelated feature-table refactors.
