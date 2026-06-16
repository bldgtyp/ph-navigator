import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createProject, gridCellForRowAndHeader, openRoomsTable, signIn } from "./_helpers";

const SCREENSHOT_DIR = "../planning/features/record-linking/assets/e2e/rooms-pumps";
const RECORD_EVIDENCE = process.env.RECORD_LINKING_EVIDENCE === "1";

test.describe.configure({ mode: "serial" });

test("record-linking Rooms to Pumps source and inverse loop", async ({ page }) => {
  if (RECORD_EVIDENCE) mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await signIn(page);

  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Record Linking ${suffix}`,
    btNumber: `rl-${suffix}`,
  });

  await page.getByRole("link", { name: "Equipment" }).click();
  await expect(page.getByRole("region", { name: "Equipment" })).toBeVisible();
  await page.getByRole("tab", { name: "Pumps" }).click();
  await page.getByRole("button", { name: "Add pump" }).click();
  await page.locator('td[data-field-key="record_id"]').first().dblclick();
  await page.keyboard.type("P-LINK");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("gridcell", { name: "P-LINK", exact: true })).toBeVisible();

  await openRoomsTable(page);
  await page.getByRole("button", { name: "Add New Room" }).click();
  const roomDialog = page.getByRole("dialog", { name: "New room" });
  await roomDialog.getByLabel("Number").fill("301");
  await roomDialog.getByLabel("Name").fill("Linked Room");
  await roomDialog.getByLabel("Floor level").fill("Ground");
  await roomDialog.getByLabel("Building zone").fill("Residential");
  await roomDialog.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByRole("gridcell", { name: "Linked Room", exact: true })).toBeVisible();
  const linkedRoomRow = page.locator("tr[data-row-id]").filter({ hasText: "Linked Room" });
  const linkedRoomRowId = await linkedRoomRow.getAttribute("data-row-id");
  if (!linkedRoomRowId) throw new Error("Linked Room row is missing data-row-id");

  await page.getByRole("button", { name: "Add field" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add field" });
  await addDialog.getByLabel(/^(Field )?Name$/).fill("Pump");
  await addDialog.getByRole("radio", { name: "Linked record" }).click();
  await addDialog.getByLabel("Target table").selectOption({ label: "Pumps" });
  await addDialog.getByRole("button", { name: /Add field/ }).click();
  await expect(addDialog).toBeHidden();
  await expect(page.getByRole("columnheader", { name: /^Pump\b/ })).toBeVisible();

  const pumpCell = await gridCellForRowAndHeader(page, {
    rowCellText: "Linked Room",
    headerName: "Pump",
  });
  await pumpCell.dblclick();
  const picker = page.getByRole("dialog", { name: "Link Pump" });
  await expect(picker).toBeVisible();
  await picker.getByLabel("Search records").fill("P-LINK");
  await picker.getByLabel("Link P-LINK").check();
  await picker.getByRole("button", { name: "Confirm" }).click();
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("button", { name: "P-LINK" })).toBeVisible();
  if (RECORD_EVIDENCE) {
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-linked-room-pill.png`, fullPage: false });
  }

  await page.reload();
  await expect(page.getByRole("region", { name: "Rooms" })).toBeVisible();
  const persistedPill = page.getByRole("button", { name: "P-LINK" });
  await expect(persistedPill).toBeVisible();
  await persistedPill.click();

  await expect(page).toHaveURL(/\/equipment\?tab=pumps&focus=/);
  await expect(page.getByRole("region", { name: "Equipment" })).toBeVisible();
  const focusedPumpRow = page.locator("tr[data-row-id]").filter({ hasText: "P-LINK" });
  await expect(focusedPumpRow).toBeVisible();
  const pumpRowId = await focusedPumpRow.getAttribute("data-row-id");
  expect(page.url()).toContain(`focus=${pumpRowId}`);
  await expect(page.getByRole("columnheader", { name: /Rooms ← Pump/ })).toBeVisible();
  await expect(focusedPumpRow.getByRole("button", { name: linkedRoomRowId })).toBeVisible();
  if (RECORD_EVIDENCE) {
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-pumps-focus-inverse.png`,
      fullPage: false,
    });
  }
});
