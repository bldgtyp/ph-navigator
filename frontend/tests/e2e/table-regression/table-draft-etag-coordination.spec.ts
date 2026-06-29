// DataTable regression suite — document-scoped draft ETag coordination.
//
// Reproduces the same mounted Equipment page workflow that regressed:
// write one Equipment sub-tab, do not Save Version, switch to another
// already-mounted Equipment sub-tab, then write again. The second write
// must refresh only its target slice before mutation instead of sending
// the stale sibling `draft_etag`.
//
// Run:
//   E2E_EMAIL=codex@example.com E2E_PASSWORD=password \
//     pnpm exec playwright test tests/e2e/table-regression --grep @table-draft-etag

import { expect, test, type Page } from "@playwright/test";
import { createProject } from "../_helpers";
import { tableCaseById, type TableRegressionCase } from "./tableMatrix";
import {
  addRowAndGetId,
  attachConsoleErrorSink,
  findDraftRow,
  openTable,
  readDraftTable,
  signInForTables,
  type ConsoleErrorSink,
} from "./tableHelpers";

const FANS = tableCaseById("fans");
const HOT_WATER_TANKS = tableCaseById("hot-water-tanks");
const PUMPS = tableCaseById("pumps");
const APPLIANCES = tableCaseById("appliances");

test.describe.configure({ mode: "serial" });

test.describe("@table-draft-etag Equipment draft ETag coordination", () => {
  let page: Page;
  let projectId: string;
  let errors: ConsoleErrorSink;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    errors = attachConsoleErrorSink(page);
    await signInForTables(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    errors.reset();
    await page.goto("/dashboard");
    const suffix = Date.now().toString().slice(-8);
    projectId = await createProject(page, {
      name: `Table Draft ETag ${suffix}`,
      btNumber: `te-${suffix}`,
    });
  });

  test("Fans -> Hot-water tanks writes without a false stale-draft blocker", async () => {
    await writeAcrossMountedEquipmentTabs({
      source: FANS,
      target: HOT_WATER_TANKS,
      targetTab: "Hot-water tanks",
    });
  });

  test("Pumps -> Appliances writes without a false stale-draft blocker", async () => {
    await writeAcrossMountedEquipmentTabs({
      source: PUMPS,
      target: APPLIANCES,
      targetTab: "Appliances",
    });
  });

  async function writeAcrossMountedEquipmentTabs(options: {
    source: TableRegressionCase;
    target: TableRegressionCase;
    targetTab: string;
  }) {
    await openTable(page, projectId, options.source);
    await addRowAndGetId(page, options.source);

    await page.getByRole("tab", { name: options.targetTab }).click();
    await expect(page.getByRole("button", { name: options.target.addRow.buttonName })).toBeVisible();
    const targetRowId = await addRowAndGetId(page, options.target);

    await expect(page.getByText(/draft changed in another tab/i)).toHaveCount(0);
    await expect(page.getByText(/Reload the draft before editing/i)).toHaveCount(0);

    const targetSlice = await readDraftTable(
      page.request,
      undefined,
      projectId,
      options.target.tableKey,
    );
    expect(findDraftRow(targetSlice, targetRowId)).toBeTruthy();
    errors.assertNoErrors(`${options.source.label} -> ${options.target.label}`);
  }
});
