// DataTable regression suite — route smoke matrix (Phase 03).
//
// Proves every target table route mounts the shared grid with its expected
// columns and a rendered body, and that mount produces no browser runtime
// error. Assertions are deliberately SHALLOW: this phase isolates
// mount/render regressions from the edit-behavior regressions covered by
// the later `@table-behavior` / `@table-regression` specs. A failure names
// the offending table (via the matrix `id`/`label`) so the broken route is
// obvious without re-running the whole matrix.
//
// One project is created once and reused across all 14 tables — the suite
// only navigates and reads, never mutates, so cross-table state can't leak.
// Run:
//   E2E_EMAIL=codex@example.com E2E_PASSWORD=password \
//     pnpm exec playwright test tests/e2e/table-regression --grep @table-smoke

import { test, type Page } from "@playwright/test";
import { createProject } from "../_helpers";
import { TABLE_REGRESSION_CASES } from "./tableMatrix";
import {
  attachConsoleErrorSink,
  expectGridBodyRendered,
  expectHeadersVisible,
  openTable,
  signInForTables,
  type ConsoleErrorSink,
} from "./tableHelpers";

// The matrix shares one signed-in page, so the tables must run in order
// (sign in + create project once, then navigate each route).
test.describe.configure({ mode: "serial" });

test.describe("@table-smoke DataTable route smoke matrix", () => {
  let page: Page;
  let projectId: string;
  let errors: ConsoleErrorSink;

  test.beforeAll(async ({ browser }) => {
    // A standalone page (not the per-test fixture) so one session + one
    // project span every table in the serial matrix.
    page = await browser.newPage();
    errors = attachConsoleErrorSink(page);
    await signInForTables(page);
    const suffix = Date.now().toString().slice(-8);
    projectId = await createProject(page, {
      name: `Table Smoke ${suffix}`,
      btNumber: `ts-${suffix}`,
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Each table only owns the errors raised during its own navigation.
  test.beforeEach(() => {
    errors.reset();
  });

  for (const table of TABLE_REGRESSION_CASES) {
    test(`${table.id} (${table.label}) mounts the grid`, async () => {
      await openTable(page, projectId, table);
      await expectHeadersVisible(page, table);
      await expectGridBodyRendered(page, table);
      errors.assertNoErrors(table.label);
    });
  }
});
