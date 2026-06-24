---
DATE: 2026-06-17
TIME: 14:40 EDT
STATUS: Phase 00 implemented
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

`Phase 00 complete — archived`.

This feature was created during DataTable consolidation archive closeout
to carry the completed refactor's non-blocking cleanup items into an
active planning folder. Phase 00 was implemented as a single cleanup pass
covering all three slices (two frontend splits + the backend validator
extraction), landed on `main`, and this folder was moved to
`planning/archive/data-table-maintenance/`.

## Next Step

None. Feature is closed.

## Phase Status

| Phase | State |
|---|---|
| 00 - Cleanup outline | Done |

## Carried Items

- [x] Split remaining oversized Heat Pump frontend files:
  - `frontend/src/features/equipment/heat-pumps/lib.ts` → 20-line barrel
    over six focused sibling modules.
  - `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
    → spec (393 lines) + `heatPumpsPanelHarness.tsx`.
- [x] Extract backend `validate_document_references` into narrower
  validators (`validate_generic_table`, `validate_typed_option_refs`, plus
  `_validate_min_zero` / `_validate_unit_fraction`).

## Blockers

None.

## Verification Plan

- Focused frontend tests for Heat Pump tables and panel behavior.
- Focused backend tests for project-document validation and affected
  table write paths.
- `make frontend-dev-check` for frontend-only slices.
- Full `make ci` if the backend validator extraction and frontend split
  land together or if the cleanup touches shared behavior.
