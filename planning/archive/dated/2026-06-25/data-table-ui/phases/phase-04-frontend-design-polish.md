---
DATE: 2026-06-25
TIME: 01:36 EDT
STATUS: Complete
AUTHOR: Codex
SCOPE: Restrained frontend-design pass and browser verification.
RELATED:
  - planning/features/data-table-ui/PLAN.md
  - frontend/src/shared/ui/data-table/DataTable.css
---

# Phase 04 - Frontend Design Polish

## Goals

- Make DataTables feel more modern while staying dense and operational.
- Verify the shared style across representative real routes.

## Design direction

Use a restrained, technical table aesthetic: crisp schedule-like rows,
quiet borders, clear numeric rhythm, compact chips, and enough contrast
to scan PH inputs quickly. Avoid decorative table chrome or marketing
style.

## Tasks

- [x] Tune row height, header height, padding, font sizes, border contrast,
  focus rings, active-cell affordances, and tint strength.
- [x] Review visual density against routes with long labels and many unit
  columns.
- [x] Capture screenshots for representative before/after comparison if
  useful. The existing browser route matrix was more useful for this pass
  than static screenshots because it exercises every current DataTable route.
- [x] Fold stable decisions into
  `context/technical-requirements/data-table.md`.

## Implementation

- Tokenized the shared table rhythm at 38px data rows, 38px normal headers,
  and 50px unit-bearing headers, with 12px horizontal cell/header padding and
  4px vertical cell padding.
- Kept the fixed `colgroup` table layout and synchronized the row virtualizer
  data-row estimate with `--data-table-row-height`.
- Softened table dividers, header background, hover/selection tints, active-cell
  focus rings, summary bar chrome, gutter typography, field-type icon color,
  unit badges, and ordinary single-select pill sizing.
- Preserved Phase 03's status-only solid chip rule; ordinary single-select,
  linked-record, toolbar, filter, and group chips remain quiet tinted pills.

## Acceptance

- Text does not overlap or clip incoherently in common desktop widths.
- Numeric columns, status columns, notes markers, and unit headers feel
  integrated rather than patched on.
- Focus, selection, edit, resize, reorder, and popover states remain
  visually clear.

## Verification

- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/GridBody.test.tsx src/shared/ui/data-table/__tests__/DataTable.test.tsx src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx src/shared/ui/data-table/__tests__/GridToolbar.test.tsx src/shared/ui/data-table/__tests__/SummaryBar.test.tsx`
  passed 121 tests. Existing React `act(...)` warnings remain in the
  number-units/DataTable tests.
- `make frontend-dev-check` passed. Existing lint output remains 14 Fast
  Refresh warnings; no errors.
- `git diff --check` passed.
- `graphify update .`
- `E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke`
  passed all 14 DataTable route-smoke tests against the local stack.
