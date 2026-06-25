---
DATE: 2026-06-25
TIME: 01:45 EDT
STATUS: Complete - archived
AUTHOR: Codex
SCOPE: Current state, next step, blockers, and verification for DataTable UI.
RELATED:
  - planning/archive/dated/2026-06-25/data-table-ui/README.md
  - planning/archive/dated/2026-06-25/data-table-ui/PRD.md
  - planning/archive/dated/2026-06-25/data-table-ui/PLAN.md
  - planning/archive/dated/2026-06-25/data-table-ui/ROUTE_MATRIX.md
---

# DataTable UI - Status

## Current state

Planning packet created from Ed's requested DataTable rendering tweaks,
then updated after reviewing the DESIGN-agent mockup under
`planning/archive/dated/2026-06-25/data-table-ui/table-redesign/`.

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

Phase 03 is complete. Built-in `status` cells now use semantic status-only
solid chip styling with Complete / Needed icons, while ordinary
`single_select` pills keep the quieter tinted treatment.

Phase 04 is complete. The shared table visual rhythm now uses tokenized
38px data rows, 38px normal headers, 50px unit-bearing headers, quieter
row dividers, restrained hover/selection tints, tuned active-cell focus,
and softened summary/gutter/chip chrome while preserving fixed layout and
row virtualization.

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

No active implementation work remains in this packet. Future table UI work
should start from `context/technical-requirements/data-table.md` plus a new
feature/refactor packet if behavior changes.

## Blockers

None.

Open decisions:

- Global search is deferred; adding it needs a separate behavior
  contract for formatted-cell matching, `ViewState` persistence, and
  interaction with existing filters/groups.
- Any future single-select prefix hiding needs an explicit display rule;
  no global stripping is allowed.

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

Phase 03 verification:

- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/GridBody.test.tsx src/shared/ui/data-table/__tests__/lib.test.ts src/features/equipment/__tests__/PumpsTable.reuse.test.tsx src/features/equipment/lib.test.ts src/features/equipment/heat-pumps/__tests__/outdoor-equip-columns.test.ts`
  passed 155 tests.
- `make frontend-dev-check` passed. Lint still reports the repo's
  existing 14 fast-refresh warnings; no errors.
- `graphify update .`

Phase 04 verification:

- `cd frontend && pnpm exec vitest run src/shared/ui/data-table/__tests__/GridBody.test.tsx src/shared/ui/data-table/__tests__/DataTable.test.tsx src/shared/ui/data-table/__tests__/numberUnitsGrid.test.tsx src/shared/ui/data-table/__tests__/GridToolbar.test.tsx src/shared/ui/data-table/__tests__/SummaryBar.test.tsx`
  passed 121 tests. Existing React `act(...)` warnings remain in the
  number-units/DataTable tests.
- `make frontend-dev-check` passed. Lint still reports the repo's
  existing 14 fast-refresh warnings; no errors.
- `git diff --check` passed.
- `graphify update .`
- `E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke`
  passed 14 route-smoke tests across Space Types, Rooms, Equipment,
  Heat Pump leaves, and Thermal Bridges.

Final closeout verification:

- `make ci` passed. Backend: 1113 passed, 2 skipped, 1 existing
  deprecation warning. Frontend: 200 test files passed, 1907 tests passed,
  with the existing Fast Refresh lint warnings and React `act(...)` /
  zero-size chart test warnings; production build completed.
