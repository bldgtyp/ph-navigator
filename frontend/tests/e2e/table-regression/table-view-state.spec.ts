// DataTable regression suite — table-view-state persistence (Phase 06).
//
// Proves sort / filter / group / hide / reorder state persists by
// (user, project, tableKey) and survives a route reload, and that the four
// heat-pump leaf tables keep independent state by their distinct stable keys.
//
// View-state is saved to the backend table-views API (debounced), so each
// gesture is proven two ways: a live DOM signal, then `expectViewStatePersisted`
// polls the read-back (which also gates the reload on the save landing).
// After reload the DOM is re-checked to prove the round-trip re-applies.
//
// Column gestures persist regardless of row count, so this spec seeds no
// rows — which also sidesteps the heat-pump unit-leaf add-dialog seeding.
//
// Run:
//   E2E_EMAIL=codex@example.com E2E_PASSWORD=password \
//     pnpm exec playwright test tests/e2e/table-regression --grep @table-view-state

import { expect, test, type Page } from "@playwright/test";
import { createProject, headerByLabel } from "../_helpers";
import { tableCaseById, type TableFieldType } from "./tableMatrix";
import {
  expectViewStatePersisted,
  filterByHeader,
  groupByHeader,
  hideField,
  openTable,
  readTableViewState,
  reloadTable,
  reorderHeaderRight,
  signInForTables,
  sortByHeader,
  visibleHeaderLabels,
  type ConsoleErrorSink,
  attachConsoleErrorSink,
} from "./tableHelpers";

const ROOMS = tableCaseById("rooms");
const PUMPS = tableCaseById("pumps");
const THERMAL_BRIDGES = tableCaseById("thermal-bridges");

// Each heat-pump leaf hides a distinct column; the bleed check asserts no
// leaf's persisted view picks up another leaf's hidden field key. The header
// is a spec choice (which column to hide); the field key is pulled from the
// matrix (single source) by representative-field type, so a backend rename
// can't leave a stale literal here.
const HP_LEAF_HIDES: ReadonlyArray<{ id: string; header: string; fieldType: TableFieldType }> = [
  { id: "heat-pumps-equipment-outdoor", header: "Manufacturer", fieldType: "single_select" },
  { id: "heat-pumps-equipment-indoor", header: "Model number", fieldType: "text" },
  { id: "heat-pumps-units-outdoor", header: "Equipment", fieldType: "linked_record" },
  { id: "heat-pumps-units-indoor", header: "Equipment", fieldType: "linked_record" },
];
const HP_LEAVES = HP_LEAF_HIDES.map(({ id, header, fieldType }) => {
  const tableCase = tableCaseById(id);
  const fieldKey = tableCase.representativeFields[fieldType];
  if (!fieldKey) throw new Error(`${tableCase.label} matrix has no ${fieldType} representative field`);
  return { case: tableCase, header, fieldKey };
});

test.describe.configure({ mode: "serial" });

test.describe("@table-view-state DataTable view-state persistence", () => {
  let page: Page;
  let projectId: string;
  let errors: ConsoleErrorSink;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    errors = attachConsoleErrorSink(page);
    await signInForTables(page);
    const suffix = Date.now().toString().slice(-8);
    projectId = await createProject(page, {
      name: `Table View State ${suffix}`,
      btNumber: `tv-${suffix}`,
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(() => {
    errors.reset();
  });

  test("Rooms — sort, filter, group, and hide all persist across reload", async () => {
    await openTable(page, projectId, ROOMS);

    await sortByHeader(page, "Name", "asc");
    await filterByHeader(page, "Floor");
    await groupByHeader(page, "Zone");
    await hideField(page, "Bedrooms");

    // Live DOM signals.
    await assertAxisChips(page, ["Sorted", "Filtered", "Grouped"]);
    await expect(headerByLabel(page, "Bedrooms"), "Bedrooms hidden").toHaveCount(0);

    // Backend persistence (also gates the reload on the debounced save).
    await expectViewStatePersisted(
      page.request,
      undefined,
      projectId,
      ROOMS.tableKey,
      (vs) =>
        vs.sort.some((rule) => rule.fieldKey === "name") &&
        vs.filter.some((rule) => rule.fieldKey === "floor_level") &&
        vs.group.some((rule) => rule.fieldKey === "building_zone") &&
        vs.hiddenColumns.includes("num_bedrooms"),
      "Rooms view-state should persist sort/filter/group/hide",
    );

    await reloadTable(page, ROOMS);
    await assertAxisChips(page, ["Sorted", "Filtered", "Grouped"]);
    await expect(headerByLabel(page, "Bedrooms"), "Bedrooms still hidden after reload").toHaveCount(0);
    errors.assertNoErrors("rooms view-state");
  });

  test("Pumps — hide and column reorder persist across reload", async () => {
    await openTable(page, projectId, PUMPS);

    const before = await visibleHeaderLabels(page);
    await reorderHeaderRight(page, "Use");
    const reordered = await visibleHeaderLabels(page);
    expect(reordered, "reorder should change the header order").not.toEqual(before);

    await hideField(page, "Device");
    await expect(headerByLabel(page, "Device"), "Device hidden").toHaveCount(0);

    await expectViewStatePersisted(
      page.request,
      undefined,
      projectId,
      PUMPS.tableKey,
      (vs) => vs.hiddenColumns.includes("device_type") && vs.columnOrder.length > 0,
      "Pumps view-state should persist hide + reorder",
    );

    await reloadTable(page, PUMPS);
    await expect(headerByLabel(page, "Device"), "Device still hidden after reload").toHaveCount(0);
    // The reordered order survives, minus the now-hidden Device column.
    expect(await visibleHeaderLabels(page), "reorder persisted after reload").toEqual(
      reordered.filter((label) => label !== "Device"),
    );
    errors.assertNoErrors("pumps view-state");
  });

  test("Thermal Bridges — sort and group persist across reload", async () => {
    await openTable(page, projectId, THERMAL_BRIDGES);

    await sortByHeader(page, "Sheet Name", "desc");
    await groupByHeader(page, "Type");
    await assertAxisChips(page, ["Sorted", "Grouped"]);

    await expectViewStatePersisted(
      page.request,
      undefined,
      projectId,
      THERMAL_BRIDGES.tableKey,
      (vs) =>
        vs.sort.some((rule) => rule.fieldKey === "sheet_name") &&
        vs.group.some((rule) => rule.fieldKey === "thermal_bridge_type"),
      "Thermal Bridges view-state should persist sort + group",
    );

    await reloadTable(page, THERMAL_BRIDGES);
    await assertAxisChips(page, ["Sorted", "Grouped"]);
    errors.assertNoErrors("thermal bridges view-state");
  });

  test("Heat-pump leaves keep independent view state by tableKey", async () => {
    // Hide a distinct column on each leaf and confirm each persists.
    for (const leaf of HP_LEAVES) {
      await openTable(page, projectId, leaf.case);
      await hideField(page, leaf.header);
      await expect(headerByLabel(page, leaf.header), `${leaf.case.label}: ${leaf.header} hidden`).toHaveCount(0);
      await expectViewStatePersisted(
        page.request,
        undefined,
        projectId,
        leaf.case.tableKey,
        (vs) => vs.hiddenColumns.includes(leaf.fieldKey),
        `${leaf.case.label}: hide should persist`,
      );
    }

    // Independence: no leaf's persisted view picks up another leaf's hide.
    for (const leaf of HP_LEAVES) {
      const vs = await readTableViewState(page.request, undefined, projectId, leaf.case.tableKey);
      const hidden = vs?.hiddenColumns ?? [];
      expect(hidden, `${leaf.case.label} keeps its own hide`).toContain(leaf.fieldKey);
      for (const other of HP_LEAVES) {
        if (other.fieldKey === leaf.fieldKey) continue;
        expect(hidden, `${leaf.case.label} must not inherit ${other.case.label}'s hide`).not.toContain(
          other.fieldKey,
        );
      }
    }

    // Reload each leaf and confirm its own hide survived.
    for (const leaf of HP_LEAVES) {
      await openTable(page, projectId, leaf.case);
      await expect(
        headerByLabel(page, leaf.header),
        `${leaf.case.label}: ${leaf.header} still hidden after reload`,
      ).toHaveCount(0);
    }
    errors.assertNoErrors("heat-pump leaf independence");
  });
});

/** Assert the named toolbar axis chips are active (e.g. "Sorted by …"). */
async function assertAxisChips(page: Page, axes: ReadonlyArray<"Sorted" | "Filtered" | "Grouped">) {
  for (const axis of axes) {
    await expect(
      page.getByRole("button", { name: new RegExp(`^${axis} by`) }),
      `${axis} chip`,
    ).toBeVisible();
  }
}
