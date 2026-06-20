// DataTable regression suite — deep linked-record flows (Phase 05).
//
// Proves the highest-risk linked-record graphs commit the expected target
// ids and survive a route reload, and that an inverse column reflects a
// link on the target table. Phase 02 pins the pure commit planners
// (dedupe / maxLinks) without a browser; this phase proves each route
// wires the picker, the draft persistence, and the inverse view together.
//
// Determinism: each flow seeds exactly one row in the target table, so the
// picker lists exactly the intended target(s) and "link the first
// candidate" is unambiguous. Correctness is asserted from the draft
// payload — the stored link id equals the seeded target's row id — not
// from the picker label.
//
// Covered (see phases/phase-05-deep-links-and-view-state.md):
//   1. Rooms -> Space Types (+ inverse "Rooms <- Space Type").
//   2. HP Equipment Outdoor -> paired Indoor Equipment (grid picker, max 1).
//   3. HP Units Indoor -> Indoor Equipment + Outdoor Unit (add-dialog links)
//      and -> served Rooms (grid multi-link). This also seeds the two HP
//      unit leaves deferred from Phase 04.
//   Rooms -> Pumps stays covered by record-linking-rooms-pumps.spec.ts.
//
// Run:
//   E2E_EMAIL=codex@example.com E2E_PASSWORD=password \
//     pnpm exec playwright test tests/e2e/table-regression --grep @table-links

import { expect, test, type Page } from "@playwright/test";
import { createProject, gridCellForRowAndHeader, readActiveVersionId } from "../_helpers";
import { tableCaseById, type TableRegressionCase } from "./tableMatrix";
import {
  addRowAndGetId,
  attachConsoleErrorSink,
  confirmPickerSelection,
  findDraftRow,
  gridCell,
  openGridPicker,
  openTable,
  readDraftTable,
  readRowLinkIds,
  reloadTable,
  signInForTables,
  type ConsoleErrorSink,
} from "./tableHelpers";

const ROOMS = tableCaseById("rooms");
const SPACE_TYPES = tableCaseById("space-types");
const HP_INDOOR_EQUIP = tableCaseById("heat-pumps-equipment-indoor");
const HP_OUTDOOR_EQUIP = tableCaseById("heat-pumps-equipment-outdoor");
const HP_OUTDOOR_UNITS = tableCaseById("heat-pumps-units-outdoor");
const HP_INDOOR_UNITS = tableCaseById("heat-pumps-units-indoor");

test.describe.configure({ mode: "serial" });

test.describe("@table-links DataTable linked-record flows", () => {
  let page: Page;
  let projectId: string;
  let errors: ConsoleErrorSink;

  // Seeded once and reused across flows. Each target table holds exactly one
  // row, which is what makes "link the first candidate" deterministic.
  let spaceTypeId: string;
  let roomId: string;
  let indoorEquipId: string;
  let outdoorEquipId: string;
  let outdoorUnitId: string;
  // The active version never changes here, so capture it once and thread it
  // into every draft read (skips a project-detail round-trip per read).
  let versionId: string;

  /** Read a draft row by id from a table's slice. */
  async function readDraftRow(
    table: TableRegressionCase,
    rowId: string,
  ): Promise<Record<string, unknown>> {
    const slice = await readDraftTable(page.request, undefined, projectId, table.tableKey, versionId);
    return findDraftRow(slice, rowId);
  }

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    errors = attachConsoleErrorSink(page);
    await signInForTables(page);
    const suffix = Date.now().toString().slice(-8);
    projectId = await createProject(page, {
      name: `Table Links ${suffix}`,
      btNumber: `tl-${suffix}`,
    });
    versionId = await readActiveVersionId(page.request, undefined, projectId);

    await openTable(page, projectId, SPACE_TYPES);
    spaceTypeId = await addRowAndGetId(page, SPACE_TYPES);

    await openTable(page, projectId, ROOMS);
    roomId = await addRowAndGetId(page, ROOMS);

    await openTable(page, projectId, HP_INDOOR_EQUIP);
    indoorEquipId = await addRowAndGetId(page, HP_INDOOR_EQUIP);

    await openTable(page, projectId, HP_OUTDOOR_EQUIP);
    outdoorEquipId = await addRowAndGetId(page, HP_OUTDOOR_EQUIP);

    // Outdoor unit add requires picking its parent outdoor equipment.
    await openTable(page, projectId, HP_OUTDOOR_UNITS);
    outdoorUnitId = await addRowAndGetId(page, HP_OUTDOOR_UNITS, {
      modalLinks: ["Outdoor equipment"],
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(() => {
    errors.reset();
  });

  test("Rooms link a Space Type and the inverse column reflects it", async () => {
    await openTable(page, projectId, ROOMS);
    const picker = await openGridPicker(page, gridCell(page, { rowId: roomId, fieldKey: "space_type_id" }));
    await confirmPickerSelection(picker, 1);

    await reloadTable(page, ROOMS);
    const room = await readDraftRow(ROOMS, roomId);
    expect(
      readRowLinkIds(room, "space_type_id"),
      "rooms.space_type_id should store the linked space type id",
    ).toContain(spaceTypeId);

    // Inverse: the Space Types table shows the linked room in its
    // "Rooms <- Space Type" column once the link exists.
    const inverseHeader = ROOMS.linkedRecordTargets?.space_type_id?.inverseHeader;
    if (!inverseHeader) throw new Error("matrix missing space_type_id inverse header");
    await openTable(page, projectId, SPACE_TYPES);
    await expect(
      page.getByRole("columnheader", { name: new RegExp(inverseHeader) }),
      "Space Types inverse column should appear",
    ).toBeVisible();
    // The inverse cell on the seeded space-type row (located by its Tag) shows
    // a pill for the linked room. Assert a pill exists rather than its label,
    // which is the room's display, not its row id.
    const inverseCell = await gridCellForRowAndHeader(page, {
      rowCellText: `QA-${spaceTypeId.slice(-6)}`,
      headerName: inverseHeader,
    });
    await expect(
      inverseCell.getByRole("button"),
      "Space Types inverse cell should show the linked room pill",
    ).toBeVisible();
    errors.assertNoErrors("rooms -> space types");
  });

  test("HP Equipment Outdoor links paired Indoor Equipment", async () => {
    await openTable(page, projectId, HP_OUTDOOR_EQUIP);
    const picker = await openGridPicker(
      page,
      gridCell(page, { rowId: outdoorEquipId, fieldKey: "paired_indoor_equip_id" }),
    );
    await confirmPickerSelection(picker, 1);

    await reloadTable(page, HP_OUTDOOR_EQUIP);
    const equip = await readDraftRow(HP_OUTDOOR_EQUIP, outdoorEquipId);
    expect(
      readRowLinkIds(equip, "paired_indoor_equip_id"),
      "outdoor equip paired_indoor_equip_id should store the indoor equipment id",
    ).toContain(indoorEquipId);
    errors.assertNoErrors("hp outdoor equip -> paired indoor equip");
  });

  test("HP Units Indoor link equipment, outdoor unit, and served rooms", async () => {
    await openTable(page, projectId, HP_INDOOR_UNITS);
    // Add-dialog required + optional links: indoor equipment and outdoor unit.
    const indoorUnitId = await addRowAndGetId(page, HP_INDOOR_UNITS, {
      modalLinks: ["Indoor equipment", "Outdoor unit"],
    });

    // Grid multi-link: served rooms (not part of the add dialog).
    const picker = await openGridPicker(
      page,
      gridCell(page, { rowId: indoorUnitId, fieldKey: "served_room_ids" }),
    );
    await confirmPickerSelection(picker, 1);

    await reloadTable(page, HP_INDOOR_UNITS);
    const unit = await readDraftRow(HP_INDOOR_UNITS, indoorUnitId);
    expect(
      readRowLinkIds(unit, "indoor_equip_id"),
      "indoor unit indoor_equip_id should store the indoor equipment id",
    ).toContain(indoorEquipId);
    expect(
      readRowLinkIds(unit, "outdoor_unit_id"),
      "indoor unit outdoor_unit_id should store the outdoor unit id",
    ).toContain(outdoorUnitId);
    expect(
      readRowLinkIds(unit, "served_room_ids"),
      "indoor unit served_room_ids should include the linked room id",
    ).toContain(roomId);
    errors.assertNoErrors("hp indoor unit links");
  });
});
