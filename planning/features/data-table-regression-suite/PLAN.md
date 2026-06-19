---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: In progress
AUTHOR: Ed (via Codex)
SCOPE: Implementation plan for DataTable regression tests.
RELATED:
  - planning/features/data-table-regression-suite/README.md
  - planning/features/data-table-regression-suite/PRD.md
  - planning/features/data-table-regression-suite/STATUS.md
  - frontend/src/shared/ui/data-table/DataTable.tsx
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
  - frontend/src/shared/ui/data-table/hooks/useGridEdit.ts
  - frontend/src/shared/ui/data-table/feature/useSliceTableController.ts
---

# DataTable Regression Suite - Plan

## Strategy

Build this as layered coverage:

1. Fast shared DataTable contract tests for edit/coercion behavior.
2. A route/table matrix that describes every target table once.
3. Playwright smoke tests that prove every target table renders.
4. Playwright behavior tests that exercise representative cells by field
   type.
5. A smaller set of deep linked-record and table-view-state regressions.

This should not start as one large e2e test. Shared behavior should be
tested once near the shared DataTable code; table-specific browser tests
should prove that each route wires the shared contract correctly.

## Proposed Test File Layout

```text
frontend/tests/e2e/table-regression/
  tableMatrix.ts
  tableHelpers.ts
  table-smoke.spec.ts
  table-cell-behavior.spec.ts
  table-linked-records.spec.ts
  table-view-state.spec.ts
```

Likely fast-test locations:

```text
frontend/src/shared/ui/data-table/__tests__/
  grid-edit-contract.test.tsx
  field-value-coercion.test.ts
  linked-record-editing.test.tsx
```

Exact filenames can change during implementation if current local test
patterns suggest a better fit.

## Matrix Entry Shape

Each table should be represented as data, not as copy/pasted test code:

```ts
type TableRegressionCase = {
  name: string;
  area: "spaces" | "equipment" | "heat-pumps" | "assets";
  route: (projectId: string) => string;
  tableKey: string;
  expectedHeaders: string[];
  addRow?: {
    buttonName: string;
    requiredFields?: Record<string, string | number>;
  };
  representativeFields: {
    text?: string;
    number?: string;
    singleSelect?: string;
    linkedRecord?: string;
  };
  linkedRecordTargets?: Record<
    string,
    {
      targetTable: string;
      targetSeed: Record<string, unknown>;
      maxLinks?: number;
      inverseHeader?: string;
    }
  >;
};
```

The test suite should print the table name and route in failure messages.
That matters because a matrix failure without table identity will be hard
to debug.

## Data Setup

Prefer deterministic setup over fragile UI preconditions.

- Use the existing Playwright auth helper, but switch default agent login to
  `codex@example.com` / `password` before broad use.
- Use existing UI helpers where they are stable.
- Use API setup for project/table seed state when UI setup would obscure
  the table behavior under test.
- Read back draft table API payloads when persistence needs to be proven
  beyond DOM display.
- Avoid test data that depends on Ed's personal browser session or
  `ed@example.com`.

## Cell Selection Contract

Tests should prefer the real grid DOM contract:

- `role="gridcell"`
- `data-row-id`
- `data-field-key`

Do not rely primarily on nth-column selectors or visible text if the same
field can appear in hidden/reordered column states.

## Phase Plan

### Phase 00 - Planning Packet

Status: complete when this docs-only packet is reviewed and committed.

- Record the table inventory.
- Record the layered test strategy.
- Record the run policy.
- Do not implement app or test code.

### Phase 01 - Inventory And Harness Design

- Confirm exact routes, table keys, table labels, add buttons, and required
  seed fields for all 14 target tables.
- Create `tableMatrix.ts`.
- Create helper APIs for opening a table, locating cells by
  `data-field-key`, committing cell edits, reloading, and reading draft
  table state.
- Fix e2e helper defaults to use `codex@example.com`, unless a newer repo
  convention has already done this.

Verification:

```bash
cd frontend && pnpm exec playwright test --list tests/e2e/table-regression
```

### Phase 02 - Shared DataTable Contract Tests

- Add focused Vitest coverage for text, number, single-select, and
  linked-record commit planning.
- Cover null clears and required-field rejection.
- Cover linked-record dedupe and `maxLinks`.
- Cover fixed unit display where shared test seams make that practical.

Verification:

```bash
cd frontend && pnpm exec vitest run src/shared/ui/data-table
```

### Phase 03 - Route Smoke Matrix

- Add a Playwright smoke spec parameterized over all 14 target tables.
- For each table, sign in, open a project, navigate to the table, assert
  expected headers, assert grid cells exist, and assert no browser runtime
  error.
- Keep assertions intentionally shallow so failures isolate mount/render
  regressions from edit regressions.

Verification:

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke
```

### Phase 04 - Cell Behavior Matrix

- Parameterize text and number edits across every table with the applicable
  representative fields.
- Parameterize single-select behavior across tables that have built-in
  selects.
- Parameterize linked-record behavior only where the table has a real
  linked-record field and deterministic target data.
- Assert DOM display, route reload, and draft payload persistence.

Verification:

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-behavior
```

### Phase 05 - Deep Links And View State

- Add focused linked-record flows for Rooms/Space Types, Rooms/Pumps, and
  Heat Pump installed-unit relationships.
- Add table-view-state checks for one standard equipment table, Rooms,
  Thermal Bridges, and all four Heat Pump leaves.
- Verify Heat Pump leaf tables do not share or bleed `tableKey` state.

Verification:

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-regression
```

### Phase 06 - Run Policy And Documentation

- Add package scripts only after the suite shape is stable.
- Document when to run smoke versus full regression.
- Fold accepted behavior contracts into
  `context/technical-requirements/data-table.md`.
- Decide, with evidence, whether any subset belongs in regular CI.

Candidate scripts:

```json
{
  "test:e2e:tables:smoke": "playwright test tests/e2e/table-regression --grep @table-smoke",
  "test:e2e:tables": "playwright test tests/e2e/table-regression --grep @table-regression"
}
```

## Validation Policy

Normal non-table frontend work should not pay for the full suite.

Recommended starting policy:

- Shared DataTable code change:
  - focused Vitest for the shared seam;
  - `make frontend-dev-check`;
  - table smoke matrix if rendering/editing could be affected.
- Table route or field definition change:
  - route smoke for affected table family;
  - behavior matrix for affected field type;
  - full table regression before final closeout if the change touches
    shared plumbing.
- Final feature closeout:
  - run the focused suite;
  - run broader repo gates only when the feature is ready for closeout.

## Open Decisions

- Whether to seed projects/tables through UI, API helpers, or a hybrid.
- Whether the first implementation should add package scripts immediately
  or keep commands explicit until the suite stabilizes.
- Whether to include visual screenshot checks after functional behavior is
  stable.
- Whether to split Heat Pump deep-link flows into their own spec file from
  the start.
- What runtime threshold makes the smoke suite acceptable for regular
  frontend checks.

## Known Preconditions

- Local frontend expected at `http://localhost:5173`.
- Local backend expected at `http://localhost:8000`.
- Browser/e2e auth should use `codex@example.com` / `password`.
- Playwright config currently uses one worker because of the single active
  session constraint.

