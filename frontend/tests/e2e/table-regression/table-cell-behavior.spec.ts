// DataTable regression suite — cell behavior matrix (Phase 04).
//
// Proves the shared editable-cell contract is wired correctly on each
// route: a text edit, a numeric edit, and a single-select commit all
// display in the grid, survive a route reload, and persist the expected
// value shape through the draft-table API. Phase 02 already pins the pure
// commit planners (coercion, null clears, option ids) without a browser;
// this phase proves each route actually rides that contract end to end.
//
// A failure names the table (matrix `id`/`label`), the field key, and the
// operation via `test.step`, so the broken surface is obvious without
// re-running the matrix.
//
// Scope (see phases/phase-04-cell-behavior-matrix.md):
//   - Text + number + single-select are exercised here.
//   - Linked-record grid edits and the two heat-pump *unit* leaves (whose
//     add dialog needs a linked-record pick to submit) are deferred to the
//     Phase 05 deep-link flow, which owns deterministic target seeding.
//   - Single-select runs only where the matrix carries a `singleSelectSample`
//     (a seeded option to pick, or the one create-mode select); empty-seeded
//     selects with an unproven create path (heat-pump `manufacturer`) are
//     skipped, their create contract covered by sharedEditContract.test.ts.
//
// One project is created once and reused; each table seeds its own row, so
// tables never share row state. Run:
//   E2E_EMAIL=codex@example.com E2E_PASSWORD=password \
//     pnpm exec playwright test tests/e2e/table-regression --grep @table-behavior

import { expect, test, type Page } from "@playwright/test";
import { createProject } from "../_helpers";
import { TABLE_REGRESSION_CASES, tableCaseById } from "./tableMatrix";
import {
  addRowAndGetId,
  attachConsoleErrorSink,
  commitCellEdit,
  commitSingleSelect,
  findDraftRow,
  gridCell,
  openTable,
  readDraftTable,
  readRowFieldValue,
  reloadTable,
  signInForTables,
  type ConsoleErrorSink,
} from "./tableHelpers";

// Tables whose add dialog can only submit after a linked-record pick are
// deferred to Phase 05's deep-link flow (which owns target seeding). The
// matrix already marks them with `addRow.requiresSeededTableKey` (only the
// two heat-pump unit leaves), so deriving the filter from that fact keeps
// the deferral attached to the case and auto-defers any future such table.
const BEHAVIOR_CASES = TABLE_REGRESSION_CASES.filter(
  (table) => !(table.addRow.mode === "dialog" && table.addRow.requiresSeededTableKey),
);

// Representative edit values. Text/number use plain constants; the exact
// number display is asserted by round-trip (commit display === reload
// display), never by the typed string, because unit-bearing fields format
// the canonical value back through the active unit system.
const TEXT_VALUE = "QA text edit";
const NUMBER_VALUE = "42";

// The matrix shares one signed-in page + project, so the tables run serially.
test.describe.configure({ mode: "serial" });

test.describe("@table-behavior DataTable cell behavior matrix", () => {
  let page: Page;
  let projectId: string;
  let errors: ConsoleErrorSink;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    errors = attachConsoleErrorSink(page);
    await signInForTables(page);
    const suffix = Date.now().toString().slice(-8);
    projectId = await createProject(page, {
      name: `Table Behavior ${suffix}`,
      btNumber: `tb-${suffix}`,
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  // Each table only owns the errors raised during its own run.
  test.beforeEach(() => {
    errors.reset();
  });

  for (const table of BEHAVIOR_CASES) {
    test(`${table.id} (${table.label}) cells edit, persist, and reload`, async () => {
      await openTable(page, projectId, table);
      const rowId = await addRowAndGetId(page, table);

      const textKey = table.representativeFields.text;
      if (!textKey) throw new Error(`${table.label}: matrix has no representative text field`);
      const numberKey = table.representativeFields.number;
      const selectKey = table.representativeFields.single_select;
      const selectSample = table.singleSelectSample;

      // --- Edit (live DOM display) ---
      await test.step(`text ${textKey}`, async () => {
        const cell = gridCell(page, { rowId, fieldKey: textKey });
        await commitCellEdit(page, cell, TEXT_VALUE, { clearFirst: true });
        await expect(cell, `${table.label}.${textKey}: text display`).toContainText(TEXT_VALUE);
      });

      let numberDisplay = "";
      if (numberKey) {
        await test.step(`number ${numberKey}`, async () => {
          const cell = gridCell(page, { rowId, fieldKey: numberKey });
          await commitCellEdit(page, cell, NUMBER_VALUE, { clearFirst: true });
          // Auto-wait for the committed value to render (formatting may differ
          // from the typed digits for unit fields), capturing it as it settles
          // so the reload step can prove the formatting is stable.
          await expect
            .poll(
              async () => {
                numberDisplay = (await cell.innerText()).trim();
                return numberDisplay;
              },
              { message: `${table.label}.${numberKey}: number display never settled` },
            )
            .not.toBe("");
        });
      }

      if (selectKey && selectSample) {
        await test.step(`single-select ${selectKey}`, async () => {
          const cell = gridCell(page, { rowId, fieldKey: selectKey });
          await commitSingleSelect(page, cell, selectSample);
          await expect(cell, `${table.label}.${selectKey}: option display`).toContainText(
            selectSample.label,
          );
        });
      }

      // --- Reload (persistence + stable formatting) ---
      await reloadTable(page, table);
      await test.step("persisted after reload", async () => {
        await expect(
          gridCell(page, { rowId, fieldKey: textKey }),
          `${table.label}.${textKey}: text after reload`,
        ).toContainText(TEXT_VALUE);
        if (numberKey) {
          await expect(
            gridCell(page, { rowId, fieldKey: numberKey }),
            `${table.label}.${numberKey}: number after reload`,
          ).toHaveText(numberDisplay);
        }
        if (selectKey && selectSample) {
          await expect(
            gridCell(page, { rowId, fieldKey: selectKey }),
            `${table.label}.${selectKey}: option after reload`,
          ).toContainText(selectSample.label);
        }
      });

      // --- Draft payload (value shape DOM display can't prove) ---
      // Skipped when the table has neither a number nor a single-select to
      // check (e.g. Space Types is text-only); their text persistence is
      // already proven by the reload step.
      if (numberKey || (selectKey && selectSample)) {
        await test.step("persisted value shape", async () => {
          const slice = await readDraftTable(page.request, undefined, projectId, table.tableKey);
          const row = findDraftRow(slice, rowId);
          if (numberKey) {
            const stored = readRowFieldValue(row, numberKey);
            expect(
              typeof stored === "number" && Number.isFinite(stored),
              `${table.label}.${numberKey}: stored a finite number, got ${JSON.stringify(stored)}`,
            ).toBe(true);
          }
          if (selectKey && selectSample) {
            const stored = readRowFieldValue(row, selectKey);
            // Single-select stores the option *id*, never the visible label.
            expect(
              typeof stored === "string" && stored.length > 0 && stored !== selectSample.label,
              `${table.label}.${selectKey}: stored an option id, got ${JSON.stringify(stored)}`,
            ).toBe(true);
          }
        });
      }

      errors.assertNoErrors(table.label);
    });
  }

  // Clearing a nullable cell must write null — never "" (text) or 0 (number).
  // DOM display can't distinguish those, so this is proven through the draft
  // payload. One representative table (Pumps: nullable, unit-free `use` and
  // `wattage`) stands in for the shared contract Phase 02 pins generically.
  test("pumps: blank nullable text/number clear to null", async () => {
    const pumps = tableCaseById("pumps");
    await openTable(page, projectId, pumps);
    const rowId = await addRowAndGetId(page, pumps);

    // Set, then clear — asserting each intermediate display so the set's
    // autosave settles before the clear (otherwise the refetch clobbers it).
    const useCell = gridCell(page, { rowId, fieldKey: "use" });
    await commitCellEdit(page, useCell, "temp", { clearFirst: true });
    await expect(useCell).toContainText("temp");
    await commitCellEdit(page, useCell, "", { clearFirst: true });
    await expect(useCell).toHaveText("");

    const wattageCell = gridCell(page, { rowId, fieldKey: "wattage" });
    await commitCellEdit(page, wattageCell, "120", { clearFirst: true });
    await expect(wattageCell).toContainText("120");
    await commitCellEdit(page, wattageCell, "", { clearFirst: true });
    await expect(wattageCell).toHaveText("");

    await reloadTable(page, pumps);
    const slice = await readDraftTable(page.request, undefined, projectId, pumps.tableKey);
    const row = findDraftRow(slice, rowId);

    const use = readRowFieldValue(row, "use");
    expect(use ?? null, "pumps.use cleared to null").toBeNull();
    expect(use, "pumps.use must not clear to empty string").not.toBe("");

    const wattage = readRowFieldValue(row, "wattage");
    expect(wattage ?? null, "pumps.wattage cleared to null").toBeNull();
    expect(wattage, "pumps.wattage must not clear to 0").not.toBe(0);

    errors.assertNoErrors("pumps null-clear");
  });
});
