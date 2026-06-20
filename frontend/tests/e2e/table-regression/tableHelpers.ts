// DataTable regression suite — reusable browser + API harness.
//
// These helpers are table-agnostic: every function is driven by a
// `TableRegressionCase` from `tableMatrix.ts` or by the shared grid DOM
// contract (`role="gridcell"`, `data-row-id`, `data-field-key`,
// `tr[data-row-id]`). They contain NO table-specific assertions — the
// smoke / behavior / view-state specs (later phases) own those.
//
// Cell selection deliberately uses the grid's stable identity contract
// rather than nth-column or visible-text selectors, so a hidden or
// reordered column never shifts the target (see PLAN "Cell Selection
// Contract").

import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { headerByLabel, readVersionedTable, signIn } from "../_helpers";
import type { TableRegressionCase } from "./tableMatrix";

// The table suite signs in as the dedicated local agent account
// (`codex@example.com`), never the user's `ed@example.com`, because PHN
// enforces one active session per user. `E2E_EMAIL` / `E2E_PASSWORD`
// override the default for CI or alternate accounts. Seed the account
// first with `make seed-agent-user`.
const AGENT_EMAIL = process.env.E2E_EMAIL ?? "codex@example.com";
const AGENT_PASSWORD = process.env.E2E_PASSWORD ?? "password";

/** Sign in as the dedicated local agent account for table-suite runs. */
export async function signInForTables(page: Page): Promise<void> {
  await signIn(page, { email: AGENT_EMAIL, password: AGENT_PASSWORD });
}

/**
 * The two render signals every target table shares once its grid mounts:
 * the wrapping region and the table-specific footer add-row button. The
 * add button's `aria-label` is unique per table, so waiting on it
 * confirms the *correct* table mounted — important for the equipment
 * tables, which all share the region name "Equipment".
 */
async function expectTableReady(page: Page, table: TableRegressionCase): Promise<void> {
  // The two signals are independent, so wait on them concurrently.
  // Disabled add buttons (e.g. heat-pump unit leaves before a parent row
  // exists) are still visible, which is all we need as a render signal.
  await Promise.all([
    expect(page.getByRole("region", { name: table.regionName })).toBeVisible(),
    expect(page.getByRole("button", { name: table.addRow.buttonName })).toBeVisible(),
  ]);
}

/**
 * Navigate straight to a table via its deep-link route and wait for the
 * grid to render. Direct `goto` is more robust than clicking the nav
 * chain and works for every area, including `?tab=` equipment tabs and
 * nested heat-pump leaf paths (the page seeds the active tab/leaf from
 * the URL). Requires an authenticated session and an existing project.
 */
export async function openTable(
  page: Page,
  projectId: string,
  table: TableRegressionCase,
): Promise<void> {
  await page.goto(table.route(projectId));
  await expectTableReady(page, table);
}

/** Reload the current route and wait for the same table to re-render. */
export async function reloadTable(page: Page, table: TableRegressionCase): Promise<void> {
  await page.reload();
  await expectTableReady(page, table);
}

/**
 * Assert every default-visible header named in the matrix is visible.
 * `headerByLabel`'s strict single-element resolution also fails if a header
 * label is duplicated, so this doubles as a uniqueness check. The per-header
 * failure message names the table + header so a smoke failure points
 * straight at the offending column without re-deriving the matrix.
 */
export async function expectHeadersVisible(page: Page, table: TableRegressionCase): Promise<void> {
  for (const header of table.expectedHeaders) {
    await expect(
      headerByLabel(page, header),
      `${table.label}: expected header "${header}" to be visible`,
    ).toBeVisible();
  }
}

/**
 * Assert the grid mounted and rendered a body. A freshly seeded project's
 * tables are empty, so accept either a real data row or the empty-state
 * cell — both prove the body rendered without crashing. This is the
 * "at least one cell or valid empty-state affordance" smoke contract.
 */
export async function expectGridBodyRendered(page: Page, table: TableRegressionCase): Promise<void> {
  await expect(page.getByRole("grid"), `${table.label}: grid container`).toBeVisible();
  const dataRow = page.locator("tr[data-row-id]").first();
  const emptyState = page.locator("td.data-table-filter-empty").first();
  await expect(
    dataRow.or(emptyState),
    `${table.label}: grid body rendered neither a data row nor an empty state`,
  ).toBeVisible();
}

// Well-known benign browser console noise. ResizeObserver loop messages are
// emitted by Chromium itself when an observer callback (the grid uses them
// for column/row virtualization) reflows within the same frame; they are
// not app errors. Keep this list tight — anything not matched here fails
// the smoke so real mount errors surface.
const IGNORED_CONSOLE_ERROR_PATTERNS: ReadonlyArray<RegExp> = [
  /ResizeObserver loop/i,
  /favicon\.ico/i,
];

/**
 * Captures `console.error` and uncaught page errors for the smoke matrix,
 * so a table that mounts but throws on render is caught even when its DOM
 * still renders. {@link ConsoleErrorSink.reset} clears the buffer between
 * tables (the smoke shares one page across the matrix);
 * {@link ConsoleErrorSink.assertNoErrors} fails with the captured text.
 */
export type ConsoleErrorSink = {
  reset: () => void;
  assertNoErrors: (context: string) => void;
};

/** Attach console/page-error listeners to a page and buffer the errors. */
export function attachConsoleErrorSink(page: Page): ConsoleErrorSink {
  const errors: string[] = [];
  const keep = (text: string) => !IGNORED_CONSOLE_ERROR_PATTERNS.some((re) => re.test(text));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (keep(text)) errors.push(`console.error: ${text}`);
  });
  page.on("pageerror", (error) => {
    if (keep(error.message)) errors.push(`pageerror: ${error.message}`);
  });
  return {
    reset: () => {
      errors.length = 0;
    },
    assertNoErrors: (context) => {
      expect(errors, `${context} produced browser errors:\n${errors.join("\n")}`).toEqual([]);
    },
  };
}

/** Locate a specific grid cell by row id + field key (the stable contract). */
export function gridCell(page: Page, options: { rowId: string; fieldKey: string }): Locator {
  return page.locator(
    `td[role="gridcell"][data-row-id="${options.rowId}"][data-field-key="${options.fieldKey}"]`,
  );
}

/**
 * Locate the first cell for a field across all rows. Convenient for the
 * common single-new-row case; prefer {@link gridCell} when the test holds
 * a specific row id.
 */
export function firstGridCellForField(page: Page, fieldKey: string): Locator {
  return page.locator(`td[role="gridcell"][data-field-key="${fieldKey}"]`).first();
}

/** The `data-row-id` of the first rendered data row. Throws if none. */
export async function firstRowId(page: Page): Promise<string> {
  const row = page.locator("tr[data-row-id]").first();
  await expect(row).toBeVisible();
  const rowId = await row.getAttribute("data-row-id");
  if (!rowId) throw new Error("First table row is missing data-row-id");
  return rowId;
}

/**
 * Commit a text/number cell edit through the real inline editor: open the
 * cell, optionally clear it, type the value, and commit with Enter. This
 * is the text/number/url path only — single-select and linked-record
 * cells open popovers/pickers and are driven by their own helpers in
 * later phases.
 */
export async function commitCellEdit(
  page: Page,
  cell: Locator,
  value: string,
  options: { clearFirst?: boolean } = {},
): Promise<void> {
  await cell.dblclick();
  if (options.clearFirst) {
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
  }
  await page.keyboard.type(value);
  await page.keyboard.press("Enter");
}

/** The draft-table slice shape returned by the generic read endpoint. */
export type DraftTableSlice = {
  field_defs?: ReadonlyArray<Record<string, unknown>>;
  rows?: ReadonlyArray<Record<string, unknown>>;
  [key: string]: unknown;
};

/**
 * Read a table's live draft slice through the generic project-document
 * API, to prove persistence beyond DOM display. Pass `page.request` so the
 * call carries the signed-in session cookie (Vite proxies `/api` to the
 * backend), and an optional `versionId` to skip the project-detail
 * round-trip when the active version is already known.
 *
 * Uses the editable `draft/tables/{key}` endpoint (not the saved
 * `document/tables/{key}`) so in-progress edits are visible before a
 * version save.
 */
export async function readDraftTable(
  request: APIRequestContext,
  baseURL: string | undefined,
  projectId: string,
  tableKey: string,
  versionId?: string,
): Promise<DraftTableSlice> {
  return readVersionedTable(request, baseURL, projectId, `draft/tables/${tableKey}`, versionId);
}
