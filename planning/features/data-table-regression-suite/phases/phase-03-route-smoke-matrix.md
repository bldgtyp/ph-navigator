---
DATE: 2026-06-19
TIME: 19:04 EDT
STATUS: Complete
AUTHOR: Ed (via Codex)
SCOPE: Browser smoke coverage for all target table routes.
RELATED:
  - planning/features/data-table-regression-suite/PLAN.md
  - frontend/tests/e2e/table-regression/table-smoke.spec.ts
  - frontend/tests/e2e/table-regression/tableHelpers.ts
---

# Phase 03 - Route Smoke Matrix

## Goal

Prove that every target table route mounts the expected DataTable surface
without conflating route/render failures with edit-behavior failures.

## Planned Tasks

1. Parameterize a Playwright smoke spec over the table matrix.
2. Open each route through the real project UI or deterministic route helper.
3. Assert table/subtab title or selected navigation state.
4. Assert expected headers are present.
5. Assert the grid exists and exposes at least one cell or valid empty-state
   affordance.
6. Assert no browser console/runtime error appears during mount.
7. Keep smoke assertions shallow and failure messages table-specific.

## Target Tables

- Space Types
- Rooms
- Ventilators
- Heat Pumps - Equipment Outdoor
- Heat Pumps - Equipment Indoor
- Heat Pumps - Units Outdoor
- Heat Pumps - Units Indoor
- Pumps
- Fans
- Hot Water Heaters
- Hot Water Tanks
- Electric Heaters
- Appliances
- Thermal Bridges

## Verification

```bash
cd frontend && E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke
```

## Outcome

Complete. Shipped `frontend/tests/e2e/table-regression/table-smoke.spec.ts`
plus four reusable helpers in `tableHelpers.ts`.

### What landed

- **`table-smoke.spec.ts`** — one `@table-smoke` test per matrix entry (14
  total). A single signed-in agent session creates one project in
  `beforeAll` and every table reuses it; the suite only navigates and
  reads, so no per-table teardown or cross-table state leak is possible.
  Each test: `openTable` (deep-link `goto` + region/add-button render
  wait) → assert every default-visible header → assert the grid body
  rendered → assert no browser error. Failure messages carry the matrix
  `id`/`label`, so a broken route is named without re-running the matrix.
- **`tableHelpers.ts` additions**:
  - `headerByLabel` / `expectHeadersVisible` — resolve a header by its
    exact `.data-table-header-label` text (not accessible name), so
    number-with-units columns and type-icon columns still match by plain
    label. Reuses the column-resolution contract from `_helpers.ts`
    `openHeaderMenu`.
  - `expectGridBodyRendered` — asserts `role="grid"` is visible and the
    body rendered either a `tr[data-row-id]` or the
    `td.data-table-filter-empty` empty-state cell. A fresh project's
    tables are empty, so the empty-state path is the common case; this is
    the "at least one cell or valid empty-state affordance" contract.
  - `attachConsoleErrorSink` (+ `ConsoleErrorSink`) — buffers
    `console.error` and uncaught `pageerror` events so a table that
    mounts-but-throws is caught even when its DOM still paints. Resets
    per table; a tight allow-list ignores only ResizeObserver-loop and
    favicon noise.

### Decisions

- **Shallow by design.** No edits, no seeding, no persistence read-back —
  those are Phase 04/05. The smoke isolates mount/render regressions so a
  red smoke means "the route/columns broke," not "an edit broke."
- **Header match on the label span, not the accessible name.** The
  accessible name of a number column also includes its unit chip
  (`numberUnitLabel`), so an exact accessible-name match would spuriously
  fail. Matching `.data-table-header-label` is the same seam the existing
  header helpers use.
- **Empty-state is a passing render signal.** Seeding 14 tables just to
  assert a data cell would re-introduce the edit-vs-render coupling this
  phase exists to avoid.

### Matrix validation (bonus)

The run is the first time the Phase 01 matrix was checked against the live
DOM. All 14 routes, region names, add-button labels, and every
default-visible header in `expectedHeaders` resolved — the matrix's cited
facts are confirmed correct end-to-end.

### Verification result

`E2E_EMAIL=codex@example.com E2E_PASSWORD=password pnpm exec playwright
test tests/e2e/table-regression --grep @table-smoke` → **14 passed
(7.8s)**, zero captured browser errors. `--list` enumerates 14
`@table-smoke` entries. Prettier + ESLint clean on the new/changed files.

