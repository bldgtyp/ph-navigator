---
DATE: 2026-06-25
TIME: 01:12 EDT
STATUS: Active - Phase 02 complete; Phase 03 next
AUTHOR: Codex
SCOPE: Current state, next step, blockers, and verification for DataTable UI.
RELATED:
  - planning/features/data-table-ui/README.md
  - planning/features/data-table-ui/PRD.md
  - planning/features/data-table-ui/PLAN.md
  - planning/features/data-table-ui/ROUTE_MATRIX.md
---

# DataTable UI - Status

## Current state

Planning packet created from Ed's requested DataTable rendering tweaks,
then updated after reviewing the DESIGN-agent mockup under
`planning/features/data-table-ui/table-redesign/`.

Phase 00 is complete. The source-backed route matrix and written
baseline checklist live in `ROUTE_MATRIX.md`.

Phase 01 is complete. Plain number display/copy/aggregation now honors
`FieldDef.numberPrecision`; number-with-units precision remains active
unit-system specific; semantic numeric cells emit a shared marker/class;
and empty numeric display cells render a muted em dash without changing
stored values.

Phase 02 is complete. Unit-bearing headers use a deliberate two-line
layout with the active unit badge below the field name, and field
descriptions use a compact accessible icon trigger instead of the larger
`"?"` marker.

Captured requests:

- right-align all numeric DataTable cells;
- investigate and fix Number decimal precision behavior;
- shrink the header description `"?"` marker;
- move unit labels under field names using a deliberate double-height
  header mechanism;
- improve status chips with better typography, colors, and possibly
  check/X icons;
- evaluate solid-fill white-text chip styling;
- run a restrained frontend-design pass over table padding, fonts,
  colors, and sizing.

## Next step

Start Phase 03 by improving status chip typography/color/iconography
and documenting whether solid chip styling applies globally or only to
status-like semantic states.

## Blockers

None.

Open decisions:

- Global search is deferred; adding it needs a separate behavior
  contract for formatted-cell matching, `ViewState` persistence, and
  interaction with existing filters/groups.
- Whether single-select prefix hiding needs a new explicit display rule.
- Whether solid chips apply globally or only to status-like semantic
  states.

## Verification so far

Phase 00 docs/source verification:

- `graphify query "DataTable consumers and routes for data-table-ui route matrix"`
- `rg -n "<DataTable|DataTable\\(" frontend/src --glob '*.{tsx,ts}'`
- targeted source reads of route owners and DataTable consumer props.

No browser screenshots were captured in Phase 00; the written baseline
checklist in `ROUTE_MATRIX.md` is the pre-change reference until the
later browser polish pass.

Phase 01 verification:

- failing reproduction before fix:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/lib.test.ts src/shared/ui/data-table/__tests__/GridBody.test.tsx`
- passing focused coverage:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/lib.test.ts src/shared/ui/data-table/__tests__/GridBody.test.tsx src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx src/shared/ui/data-table/__tests__/aggregations.test.ts`
  passed 83 tests, with existing React `act(...)` warnings in
  `numberUnitsGrid.test.tsx`.
- passing adjacent coverage:
  `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/csv.test.ts src/shared/ui/data-table/__tests__/filterOperators.test.ts src/shared/ui/data-table/__tests__/useTableSchema.test.ts`
  passed 32 tests.
- `make frontend-dev-check` passed. Lint still reports the repo's
  existing 14 fast-refresh warnings; no errors.
- `graphify update .`

Phase 02 verification:

- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/CustomFieldDescriptionTooltip.test.tsx src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx src/shared/ui/data-table/__tests__/SortableHeaderCell.test.tsx src/shared/ui/data-table/__tests__/columnHeaderDoubleClick.test.tsx`
  passed 33 tests, with existing React `act(...)` warnings in
  `numberUnitsGrid.test.tsx`.
