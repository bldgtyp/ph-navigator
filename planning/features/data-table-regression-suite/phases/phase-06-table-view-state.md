---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Planned
AUTHOR: Ed (via Codex)
SCOPE: Persisted table-view-state regression coverage.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - frontend/src/features/table_views/hooks.ts
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
---

# Phase 06 - Table-View-State Persistence

> Split note: this phase was split out of the original "Phase 05 - Deep links
> and view state". Linked-record flows are Phase 05; this phase owns the
> persisted view-state matrix. See `STATUS.md`.

## Goal

Prove sort / filter / hide-show / reorder / group state persists by
`(projectId, tableKey)` and survives a route reload, and that the four
heat-pump leaf tables keep independent state by their stable, distinct keys.

## Planned Table-View-State Flows

1. Hide/show a column and reload.
2. Reorder a column and reload.
3. Sort and reload.
4. Filter and reload.
5. Group and reload where grouping is supported.
6. Verify heat-pump leaf tables keep independent state by stable `tableKey`
   (changing one leaf's view does not bleed into another).

## Coverage Selection

Run view-state checks against:

- Rooms
- one standard Equipment table
- all four heat-pump leaf tables
- Thermal Bridges

This avoids testing the same shared view-state behavior 14 times while still
covering the table-key families that have been risky.

## Verification

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-view-state
```
