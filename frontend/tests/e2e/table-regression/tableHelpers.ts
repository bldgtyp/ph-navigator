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
import type { SingleSelectSample, TableRegressionCase } from "./tableMatrix";

// The table suite signs in as the dedicated local agent account
// (`codex@example.com`), never the user's `ed@example.com`, because PHN
// enforces one active session per user. `E2E_EMAIL` / `E2E_PASSWORD`
// override the default for CI or alternate accounts. Seed the account
// first with `make seed-agent-user`.
const AGENT_EMAIL = process.env.E2E_EMAIL ?? "codex@example.com";
const AGENT_PASSWORD = process.env.E2E_PASSWORD ?? "password";

// The reserved built-in identifier field ("Tag") shared by every table —
// mirrors RESERVED_FIELD_KEY_RECORD_ID in the backend registry.
const RECORD_ID_FIELD_KEY = "record_id";

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
  if (value) await page.keyboard.type(value);
  await page.keyboard.press("Enter");
  // Wait for the inline editor to detach so the commit is fully applied
  // before the next gesture. An open editor leaves the cell's text content
  // empty, so without this a follow-up edit can start mid-commit and be
  // clobbered by the draft autosave's refetch.
  await expect(cell.locator("input.data-table-cell-editor")).toHaveCount(0);
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

// --- Phase 04: row seeding + cell behavior --------------------------------

/** The `data-row-id` of every rendered data row, in DOM order. */
async function allDataRowIds(page: Page): Promise<string[]> {
  return page
    .locator("tr[data-row-id]")
    .evaluateAll((rows) =>
      rows
        .map((row) => (row as HTMLElement).dataset.rowId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    );
}

/**
 * Add one row to the table through the real UI and return its grid row id
 * (`getRowId(row) === row.id` for every target table, so the returned id is
 * also the draft-payload `id`). Handles both add modes from the matrix:
 * `inline` footer buttons insert a blank row directly; `dialog` buttons open
 * a modal whose fields are filled and submitted. The new id is found by
 * diffing the row-id set before/after the add, so it is correct whether the
 * table started empty or already had rows.
 *
 * Tables whose add dialog requires a linked-record pick to submit
 * (the heat-pump unit leaves) are out of scope here — they are seeded by the
 * Phase 05 deep-link flow, which owns the picker interaction.
 */
export async function addRowAndGetId(page: Page, table: TableRegressionCase): Promise<string> {
  const before = new Set(await allDataRowIds(page));
  await page.getByRole("button", { name: table.addRow.buttonName }).click();

  if (table.addRow.mode === "dialog") {
    const dialog = page.getByRole("dialog", { name: table.addRow.dialogTitle });
    await expect(dialog, `${table.label}: add dialog "${table.addRow.dialogTitle}"`).toBeVisible();
    for (const field of table.addRow.fields) {
      await dialog.getByLabel(field.label).fill(field.value);
    }
    await dialog.getByRole("button", { name: table.addRow.submitName }).click();
    await expect(dialog, `${table.label}: add dialog should close after submit`).toBeHidden();
  }

  // Capture the diffed ids as the poll settles so the new id doesn't need a
  // second full-DOM read after the wait.
  let added: string[] = [];
  await expect
    .poll(
      async () => {
        added = (await allDataRowIds(page)).filter((id) => !before.has(id));
        return added.length;
      },
      { message: `${table.label}: no new row appeared after "${table.addRow.buttonName}"` },
    )
    .toBeGreaterThan(0);

  const newId = added.at(-1);
  if (!newId) throw new Error(`${table.label}: could not resolve the added row id`);

  // Inline-added rows start blank. A few tables (e.g. Space Types, the
  // heat-pump leaves) reject a non-blank row that has no Tag, so give every
  // inline row a unique Tag up front — this mirrors how a user identifies a
  // row before filling it and keeps later representative-field edits valid.
  // Dialog rows already carry an identity from the submitted form.
  if (table.addRow.mode === "inline") {
    const tagCell = gridCell(page, { rowId: newId, fieldKey: RECORD_ID_FIELD_KEY });
    if ((await tagCell.count()) > 0) {
      const tag = `QA-${newId.slice(-6)}`;
      await commitCellEdit(page, tagCell, tag, { clearFirst: true });
      // Settle before the caller's next edit: wait for the committed Tag to
      // render so the seed's autosave/refetch can't clobber the following
      // representative-field edit mid-flight.
      await expect(tagCell, `${table.label}: seeded Tag should render`).toContainText(tag);
    }
  }
  return newId;
}

/**
 * Open a single-select cell's option popover and commit the sample option.
 * Single-select cells open via the right-edge chevron (not double-click —
 * see GridBody), so the cell is activated first to make the chevron
 * interactive, then the popover search + listbox drive the commit. `existing`
 * picks a seeded option by exact label; `create` mints a new option through
 * the popover's "+ Create" footer.
 */
export async function commitSingleSelect(
  page: Page,
  cell: Locator,
  sample: SingleSelectSample,
): Promise<void> {
  await cell.click();
  await cell.getByRole("button", { name: "Open options" }).click();

  const popover = page.locator(".single-select-popover");
  await expect(popover, "single-select popover").toBeVisible();
  await popover.getByRole("textbox", { name: "Search options" }).fill(sample.label);

  if (sample.mode === "existing") {
    await popover.getByRole("option", { name: sample.label, exact: true }).click();
  } else {
    // The Create footer is the only option once the search excludes every
    // seeded label; match it loosely (its label carries smart quotes). The
    // typed search text (`sample.label`) becomes the new option's label, so
    // the caller can assert the cell shows `sample.label` afterwards.
    await popover.getByRole("option", { name: /Create/ }).click();
  }
  await expect(popover, "single-select popover should close after commit").toBeHidden();
}

/**
 * Find a draft-slice row by its grid/payload id. The generic
 * `draft/tables/{key}` endpoint returns a per-table response whose row list
 * lives under a table-specific key (`space_types`, `pumps`, …) — never a
 * uniform `rows` — so this scans every array field for the entry carrying the
 * matching `id`. Only row objects carry a row `id`, so the match is
 * unambiguous. Throws if absent.
 */
export function findDraftRow(slice: DraftTableSlice, rowId: string): Record<string, unknown> {
  for (const value of Object.values(slice)) {
    if (!Array.isArray(value)) continue;
    const match = value.find(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null && (entry as { id?: unknown }).id === rowId,
    );
    if (match) return match;
  }
  throw new Error(`Draft slice has no row with id ${rowId}`);
}

/**
 * Read a field's stored value off a draft row, mirroring the frontend's
 * `getCustomValue` precedence (custom_values → custom → top-level). Built-in
 * mutable fields live in the `custom_values` bag while locked-type built-ins
 * stay typed top-level columns, so this is the only correct way to read a
 * representative field by key without knowing its storage class.
 *
 * Unlike the frontend's `??`-chained reader, this checks key *presence* so a
 * stored `null` (e.g. a cleared nullable field) is returned as `null` rather
 * than skipped — the null-clear assertions depend on that distinction.
 */
export function readRowFieldValue(row: Record<string, unknown>, fieldKey: string): unknown {
  const customValues = row.custom_values as Record<string, unknown> | undefined;
  if (customValues && fieldKey in customValues) return customValues[fieldKey];
  const custom = row.custom as Record<string, unknown> | undefined;
  if (custom && fieldKey in custom) return custom[fieldKey];
  return row[fieldKey];
}
