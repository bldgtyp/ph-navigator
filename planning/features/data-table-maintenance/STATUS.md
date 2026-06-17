---
DATE: 2026-06-17
TIME: 14:40 EDT
STATUS: Active - outline, not started
AUTHOR: Ed (via Codex)
SCOPE: Current state of DataTable maintenance cleanup follow-up.
RELATED:
  - planning/features/data-table-maintenance/README.md
  - planning/features/data-table-maintenance/PRD.md
  - planning/features/data-table-maintenance/phases/phase-00-cleanup-outline.md
  - planning/archive/data-table-consolidation/STATUS.md
---

# DataTable Maintenance - Status

## Current State

`Active - outline, not started`.

This feature was created during DataTable consolidation archive closeout
to carry the completed refactor's non-blocking cleanup items into an
active planning folder.

## Next Step

Choose whether to implement Phase 00 as one cleanup pass or split it into
separate frontend and backend phases.

## Phase Status

| Phase | State |
|---|---|
| 00 - Cleanup outline | Planned |

## Carried Items

- Split remaining oversized Heat Pump frontend files:
  - `frontend/src/features/equipment/heat-pumps/lib.ts`;
  - `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`.
- Extract backend `validate_document_references` into narrower validators
  after the DataTable data-shape changes have landed.

## Blockers

None.

## Verification Plan

- Focused frontend tests for Heat Pump tables and panel behavior.
- Focused backend tests for project-document validation and affected
  table write paths.
- `make frontend-dev-check` for frontend-only slices.
- Full `make ci` if the backend validator extraction and frontend split
  land together or if the cleanup touches shared behavior.
