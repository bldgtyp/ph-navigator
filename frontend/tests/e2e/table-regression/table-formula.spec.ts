// DataTable regression suite — formula editor rollout matrix.
//
// Proves every field-config-capable DataTable reaches the shared formula
// editor and autocomplete from its Add field modal. Deep formula semantics
// stay at the shared parser/evaluator/backend seams; this browser suite only
// proves the shared UI is wired through each route plus one persisted Rooms
// formula using `&`.
//
// Run:
//   E2E_EMAIL=codex@example.com E2E_PASSWORD=password \
//     pnpm exec playwright test tests/e2e/table-regression --grep @table-formula

import { expect, test, type Locator, type Page } from "@playwright/test";
import { createProject, headerByLabel } from "../_helpers";
import { TABLE_REGRESSION_CASES, tableCaseById } from "./tableMatrix";
import {
  addRowAndGetId,
  attachConsoleErrorSink,
  openTable,
  reloadTable,
  signInForTables,
  type ConsoleErrorSink,
} from "./tableHelpers";

const FORMULA_SOURCE = '"Room - " & {Name}';
const FORMULA_RESULT = "Room - Living Room";
const FORMULA_FIELD_NAME = "Formula Label";

test.describe.configure({ mode: "serial" });

test.describe("@table-formula @table-regression DataTable formula editor rollout", () => {
  let page: Page;
  let projectId: string;
  let errors: ConsoleErrorSink;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    errors = attachConsoleErrorSink(page);
    await signInForTables(page);
    const suffix = Date.now().toString().slice(-8);
    projectId = await createProject(page, {
      name: `Table Formula ${suffix}`,
      btNumber: `tf-${suffix}`,
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(() => {
    errors.reset();
  });

  for (const table of TABLE_REGRESSION_CASES) {
    test(`${table.id} (${table.label}) exposes the shared formula editor`, async () => {
      await openTable(page, projectId, table);
      const dialog = await openFormulaAddFieldDialog(page, table.label);

      await expect(dialog.getByLabel("Expression"), `${table.label}: formula source`).toBeVisible();
      await expect(
        dialog.locator(".formula-source-editor-highlight"),
        `${table.label}: syntax highlighter`,
      ).toBeVisible();

      await dialog.getByLabel("Expression").fill("{");
      await expect(
        dialog.getByText("Insert a field or function"),
        `${table.label}: suggestion panel title`,
      ).toBeVisible();
      await expect(
        dialog.getByRole("option").first(),
        `${table.label}: at least one field suggestion`,
      ).toBeVisible();

      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog, `${table.label}: formula dialog closes`).toBeHidden();
      errors.assertNoErrors(table.label);
    });
  }

  test("rooms persists an ampersand formula and recomputes after reload", async () => {
    const rooms = tableCaseById("rooms");
    await openTable(page, projectId, rooms);
    const rowId = await addRowAndGetId(page, rooms);

    const dialog = await openFormulaAddFieldDialog(page, rooms.label);
    await dialog.getByLabel(/^(Field )?Name$/).fill(FORMULA_FIELD_NAME);
    await dialog.getByLabel("Expression").fill(FORMULA_SOURCE);
    await dialog.getByRole("button", { name: /Add field/ }).click();
    await expect(dialog, "formula add dialog closes after save").toBeHidden();
    await expect(headerByLabel(page, FORMULA_FIELD_NAME)).toBeVisible();

    await reloadTable(page, rooms);
    await expect(headerByLabel(page, FORMULA_FIELD_NAME)).toBeVisible();
    await expect(await gridCellByHeader(page, rowId, FORMULA_FIELD_NAME)).toContainText(
      FORMULA_RESULT,
    );
    errors.assertNoErrors("Rooms formula persistence");
  });
});

async function openFormulaAddFieldDialog(page: Page, label: string): Promise<Locator> {
  await page.getByRole("button", { name: "Add field" }).click();
  const dialog = page.getByRole("dialog", { name: "Add field" });
  await expect(dialog, `${label}: Add field dialog`).toBeVisible();
  await dialog.getByRole("radio", { name: "Formula" }).click();
  return dialog;
}

async function gridCellByHeader(page: Page, rowId: string, header: string): Promise<Locator> {
  const headerCell = headerByLabel(page, header);
  await expect(headerCell).toBeVisible();
  const columnIndex = await headerCell.getAttribute("aria-colindex");
  if (!columnIndex) throw new Error(`${header} column is missing aria-colindex`);
  const cell = page.locator(`tr[data-row-id="${rowId}"] td[aria-colindex="${columnIndex}"]`);
  await expect(cell).toBeVisible();
  return cell;
}
