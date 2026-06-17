---
DATE: 2026-06-17
TIME: 14:40 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Initial cleanup slice for deferred DataTable consolidation items.
RELATED:
  - planning/features/data-table-maintenance/README.md
  - planning/features/data-table-maintenance/STATUS.md
  - planning/archive/data-table-consolidation/phases/phase-06-verification-docs-closeout.md
---

# Phase 00 - Cleanup Outline

## Goal

Retire the two cleanup items extracted from DataTable consolidation
without changing user-visible table behavior.

## Tasks

1. [ ] Split Heat Pump frontend support code so
   `frontend/src/features/equipment/heat-pumps/lib.ts` no longer needs a
   structural guard exception.
2. [ ] Split Heat Pump panel tests so
   `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
   no longer needs a structural guard exception.
3. [ ] Extract backend document reference validation out of the current
   oversized `validate_document_references` path into narrower validators.
4. [ ] Preserve existing error payloads or update tests and docs if a
   payload is intentionally clarified.
5. [ ] Run focused frontend/backend tests for touched areas.

## Acceptance Criteria

- Size-exception comments added during DataTable consolidation are
  removed.
- Backend validator code is easier to scan and test without losing
  reject-on-write coverage.
- No DataTable route, row payload, schema fingerprint, or table-view
  endpoint contract changes.

## Notes

This is cleanup after a completed refactor, not a prerequisite for
DataTable consolidation closeout.
