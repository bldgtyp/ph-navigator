---
DATE: 2026-06-24
TIME: 20:44 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Numeric alignment plus decimal precision bug investigation.
RELATED:
  - planning/features/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionNumber.tsx
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionNumberUnits.tsx
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

- Plain numbers and unit numbers render to the expected decimal places.
- Numeric values align right across representative tables.
- Tests fail before the precision fix and pass after it.
