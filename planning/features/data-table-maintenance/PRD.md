---
DATE: 2026-06-17
TIME: 14:40 EDT
STATUS: Active - outline
AUTHOR: Ed (via Codex)
SCOPE: Product and engineering contract for DataTable maintenance cleanup.
RELATED:
  - planning/features/data-table-maintenance/README.md
  - planning/features/data-table-maintenance/STATUS.md
  - planning/archive/data-table-consolidation/STATUS.md
---

# DataTable Maintenance - PRD

## Problem

DataTable consolidation is complete, but two cleanup items remain:

1. Heat Pump frontend implementation files still carry documented
   structural guard exceptions because they remained large after the
   shared-abstraction migration.
2. Backend document reference validation still has an oversized
   `validate_document_references` path that should be split after the
   data-shape changes have stabilized.

Both items are code health work. They do not block shipped behavior, but
they affect maintainability for future table work.

## Goals

- Remove the Heat Pump size exceptions by splitting code along existing
  domain boundaries.
- Split document reference validation into narrow validators with stable
  error payloads and test coverage.
- Preserve current behavior and error semantics unless a test exposes an
  accidental inconsistency.
- Keep the shared DataTable contracts in
  `context/technical-requirements/data-table.md` as the source of truth.

## Non-Goals

- No new DataTable features.
- No changes to Heat Pump user workflows.
- No change to row payload shape, schema fingerprints, or table route
  contracts.
- No cleanup of unrelated feature files solely because they are nearby.

## Acceptance Criteria

- `frontend/src/features/equipment/heat-pumps/lib.ts` no longer needs a
  structural guard exception.
- `frontend/src/features/equipment/heat-pumps/__tests__/HeatPumpsPanel.test.tsx`
  no longer needs a structural guard exception.
- Backend document reference validation is split into smaller functions
  or modules with focused tests around asset, option, linked-record, and
  attachment-reference failures.
- Existing focused DataTable, Heat Pump, and backend validation tests
  pass after each implemented slice.
