---
DATE: 2026-07-02
TIME: 14:55 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Verify Rooms DataTable rendering/editing for airflow unit fields.
RELATED:
  - ../README.md
  - ../PRD.md
  - ../PLAN.md
---

# Phase 03 - Frontend And DataTable Behavior

## Goal

Ensure the two backend field defs flow through the existing Rooms table schema
and behave like any other unit-aware numeric DataTable field.

## Tasks

- Confirm `useTableSchema` maps persisted `config.units` to frontend
  `fieldDef.numberUnits`.
- Add or update Rooms frontend fixtures so the new field defs are available in
  tests.
- Add focused tests for:
  - headers render labels without unit suffix in `display_name`,
  - active unit pill shows `m3/h` in SI and `cfm` in IP,
  - missing/undefined/null values display blank,
  - editing in IP stores canonical SI `m3/h`,
  - clearing writes `null`, not `0` or `""`,
  - CSV/export header appends the active unit through the shared export path.
- Verify the column build path does not require bespoke Rooms columns for these
  fields; they should come from `field_defs`.

## Verification

- Focused Vitest around Rooms table/schema behavior.
- Existing shared DataTable unit tests remain green.
- No visual or behavior regressions to Space-Type link pills.
- Passed on 2026-07-02:
  `cd frontend && pnpm exec vitest run src/features/equipment/__tests__/RoomsTable.airflowFields.test.tsx src/features/equipment/lib.test.ts src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx src/shared/ui/data-table/__tests__/csv.test.ts src/shared/ui/data-table/__tests__/GridBody.test.tsx`.
