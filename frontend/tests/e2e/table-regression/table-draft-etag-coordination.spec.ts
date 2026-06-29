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

import { expect, test, type Page, type Request, type Response } from "@playwright/test";
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
const EQUIPMENT_TABLE_KEYS = new Set([
  "ventilators",
  "pumps",
  "fans",
  "hot_water_heaters",
  "hot_water_tanks",
  "electric_heaters",
  "appliances",
]);

type DraftTableNetworkEntry = {
  method: string;
  tableKey: string;
  url: string;
  status?: number;
};

type DraftTableNetworkRecorder = {
  entries: () => DraftTableNetworkEntry[];
  reset: () => void;
  stop: () => void;
};

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
    const network = attachDraftTableNetworkRecorder(page);
    try {
      network.reset();
      await addRowAndGetId(page, options.source);
      const sourceEntries = network.entries();
      expect(
        sourceEntries.filter(
          (entry) => entry.method === "PUT" && entry.tableKey === options.source.tableKey,
        ).length,
        `${options.source.label}: expected accepted source PUT`,
      ).toBeGreaterThan(0);
      expect(
        sourceEntries
          .filter(
            (entry) =>
              entry.method === "GET" &&
              EQUIPMENT_TABLE_KEYS.has(entry.tableKey) &&
              entry.tableKey !== options.source.tableKey,
          )
          .map(describeDraftTableRequest),
        `${options.source.label}: sibling GETs should not fan out after source write`,
      ).toEqual([]);

      network.reset();
      await page.getByRole("tab", { name: options.targetTab }).click();
      await expect(
        page.getByRole("button", { name: options.target.addRow.buttonName }),
      ).toBeVisible();
      const targetRowId = await addRowAndGetId(page, options.target);
      const targetEntries = network.entries();
      const targetGets = targetEntries.filter(
        (entry) => entry.method === "GET" && entry.tableKey === options.target.tableKey,
      );
      const targetPuts = targetEntries.filter(
        (entry) => entry.method === "PUT" && entry.tableKey === options.target.tableKey,
      );
      expect(
        targetGets.map(describeDraftTableRequest),
        `${options.target.label}: expected exactly one fresh target GET before write`,
      ).toHaveLength(1);
      expect(
        targetPuts.map(describeDraftTableRequest),
        `${options.target.label}: expected accepted target PUT`,
      ).not.toHaveLength(0);
      expect(
        targetEntries.filter((entry) => entry.status === 409).map(describeDraftTableRequest),
        `${options.source.label} -> ${options.target.label}: no draft_etag_mismatch responses`,
      ).toEqual([]);
      expect(
        targetEntries.findIndex(
          (entry) => entry.method === "GET" && entry.tableKey === options.target.tableKey,
        ),
        `${options.target.label}: target GET should precede target PUT`,
      ).toBeLessThan(
        targetEntries.findIndex(
          (entry) => entry.method === "PUT" && entry.tableKey === options.target.tableKey,
        ),
      );

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
    } finally {
      network.stop();
    }
  }
});

function attachDraftTableNetworkRecorder(page: Page): DraftTableNetworkRecorder {
  const entries: DraftTableNetworkEntry[] = [];
  const onRequest = (request: Request) => {
    const tableKey = draftTableKeyFromUrl(request.url());
    if (!tableKey) return;
    const method = request.method();
    if (method !== "GET" && method !== "PUT") return;
    entries.push({ method, tableKey, url: request.url() });
  };
  const onResponse = (response: Response) => {
    const request = response.request();
    const tableKey = draftTableKeyFromUrl(request.url());
    if (!tableKey) return;
    const entry = entries
      .slice()
      .reverse()
      .find(
        (candidate) =>
          candidate.url === request.url() &&
          candidate.method === request.method() &&
          candidate.status === undefined,
      );
    if (entry) entry.status = response.status();
  };
  page.on("request", onRequest);
  page.on("response", onResponse);
  return {
    entries: () => [...entries],
    reset: () => {
      entries.length = 0;
    },
    stop: () => {
      page.off("request", onRequest);
      page.off("response", onResponse);
    },
  };
}

function draftTableKeyFromUrl(rawUrl: string): string | null {
  const url = new URL(rawUrl);
  const match = url.pathname.match(/\/draft\/tables\/([^/]+)$/);
  return match?.[1] ?? null;
}

function describeDraftTableRequest(entry: DraftTableNetworkEntry): string {
  const status = entry.status === undefined ? "pending" : String(entry.status);
  return `${entry.method} ${entry.tableKey} ${status}`;
}
