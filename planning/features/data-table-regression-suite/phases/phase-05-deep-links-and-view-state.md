---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: High-risk linked-record and table-view-state regression coverage.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - frontend/src/features/table_views/hooks.ts
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
---

# Phase 05 - Deep Links And View State

## Goal

Cover the table behaviors most likely to regress after shared DataTable
changes: linked-record graphs and persisted table-view state.

## Planned Linked-Record Flows

1. Rooms -> Space Types, then verify Space Types inverse Rooms display.
2. Rooms -> Pumps, then verify Pumps inverse Rooms display.
3. Heat Pump Units Indoor -> Indoor Equipment.
4. Heat Pump Units Indoor -> Outdoor Unit.
5. Heat Pump Units Indoor -> served Rooms.
6. Heat Pump Equipment Outdoor -> paired Indoor Equipment, if the editable
   field is present in the current contract.

## Planned Table-View-State Flows

1. Hide/show a column and reload.
2. Reorder a column and reload.
3. Sort and reload.
4. Filter and reload.
5. Group and reload where grouping is supported.
6. Verify Heat Pump leaf tables keep independent state by stable table key.

## Coverage Selection

Run view-state checks against:

- Rooms
- one standard Equipment table
- all four Heat Pump leaf tables
- Thermal Bridges

This avoids testing the same shared view-state behavior 14 times while still
covering the table-key families that have been risky.

## Verification

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-regression
```

