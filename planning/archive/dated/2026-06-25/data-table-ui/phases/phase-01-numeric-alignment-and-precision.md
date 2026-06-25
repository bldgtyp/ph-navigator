---
DATE: 2026-06-25
TIME: 01:04 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Numeric alignment plus decimal precision bug investigation.
RELATED:
  - planning/archive/dated/2026-06-25/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionNumber.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionNumberUnits.tsx
  - frontend/src/shared/ui/data-table/lib/numberDisplay.ts
  - frontend/src/lib/units/numberUnits.ts
---

# Phase 01 - Numeric Alignment And Precision

## Goals

- Right-align all rendered numeric DataTable cells.
- Reproduce the plain Number decimal precision bug before fixing it.
- Confirm number-with-units precision still honors SI/IP-specific
  precision.

## Tasks

- Add focused tests for plain `number` display precision from
  `config.precision`.
- Add focused tests for `numberUnits` precision in SI and IP.
- Identify the shared formatting seam for plain numbers and make it the
  single path used by display, copy, filters, and aggregations where
  applicable.
- Add a stable semantic marker/class for numeric cells rather than
  table-local CSS selectors.
- Render numeric null/empty values as a muted em dash in display-only
  cells, without changing clipboard/write semantics until explicitly
  decided.
- Verify no precision change mutates stored values.

## Acceptance

- Complete: plain numbers with `FieldDef.numberPrecision` and unit
  numbers with SI/IP precision render to expected decimal places.
- Complete: semantic number cells now emit
  `data-numeric-cell="true"` and `data-table-numeric-cell`; CSS
  right-aligns the shared marker while preserving existing table-local
  `numeric-cell` classes.
- Complete: tests failed before the fix on plain number precision,
  clipboard precision, numeric markers, and empty-number display, then
  passed after the shared formatter/body changes.

## Verification

- Expected failing reproduction before implementation:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/lib.test.ts src/shared/ui/data-table/__tests__/GridBody.test.tsx`
  failed on plain number precision, clipboard precision,
  `data-numeric-cell`, and empty-number em dash assertions.
- Passing focused coverage:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/lib.test.ts src/shared/ui/data-table/__tests__/GridBody.test.tsx src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx src/shared/ui/data-table/__tests__/aggregations.test.ts`
  passed 83 tests. `numberUnitsGrid.test.tsx` still emits existing
  React `act(...)` warnings during the IP edit-commit test.
- Adjacent coverage:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/csv.test.ts src/shared/ui/data-table/__tests__/filterOperators.test.ts src/shared/ui/data-table/__tests__/useTableSchema.test.ts`
  passed 32 tests.
- Frontend gate:
  `make frontend-dev-check` passed. Lint still reports the repo's
  existing 14 fast-refresh warnings; no errors.
- Graph update: `graphify update .`.
