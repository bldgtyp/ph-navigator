import { expect, test } from "@playwright/test";
import { createProject, openRoomsTable, signIn } from "./_helpers";

test.describe.configure({ mode: "serial" });

// Phase 2 row-context-menu — multi-row collapse rules (PRD §5).
// Rule 1: right-click on a row inside a 2+-row checkbox selection
// collapses the menu to a single `Delete N records` item.
// Rule 2: right-click outside the selection clears the selection and
// opens the full single-row menu against the right-clicked row.

async function seedRoom(
  page: import("@playwright/test").Page,
  args: { number: string; name: string; floor?: string; zone?: string },
): Promise<void> {
  await page.getByRole("button", { name: "Add New Room" }).click();
  const dialog = page.getByRole("dialog", { name: "New room" });
  await dialog.getByLabel("Number").fill(args.number);
  await dialog.getByLabel("Name").fill(args.name);
  await dialog.getByLabel("Floor level").fill(args.floor ?? "Ground");
  await dialog.getByLabel("Building zone").fill(args.zone ?? "Residential");
  await dialog.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByRole("gridcell", { name: args.name, exact: true })).toBeVisible();
}

test("row context menu — multi-row collapse + selection-clear fallthrough", async ({ page }) => {
  await signIn(page);
  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Row Menu Multi ${suffix}`,
    btNumber: `rmm-${suffix}`,
  });
  await openRoomsTable(page);

  await seedRoom(page, { number: "101", name: "Alpha" });
  await seedRoom(page, { number: "102", name: "Bravo" });
  await seedRoom(page, { number: "103", name: "Charlie" });
  await seedRoom(page, { number: "104", name: "Delta" });

  // Select the first three rows via their gutter checkboxes.
  const checkboxes = page.locator(".data-table-gutter-checkbox");
  await checkboxes.nth(0).click();
  await checkboxes.nth(1).click();
  await checkboxes.nth(2).click();

  // Rule 1 — right-click a selected row (Alpha). Menu collapses to a
  // single `Delete 3 records` item.
  await page.getByRole("gridcell", { name: "Alpha", exact: true }).click({ button: "right" });
  const menu = page.getByRole("menu", { name: "Selected rows actions" });
  await expect(menu).toBeVisible();
  const items = menu.getByRole("menuitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("Delete 3 records");
  await items.first().click();
  await expect(page.getByRole("gridcell", { name: "Alpha", exact: true })).toHaveCount(0);
  await expect(page.getByRole("gridcell", { name: "Bravo", exact: true })).toHaveCount(0);
  await expect(page.getByRole("gridcell", { name: "Charlie", exact: true })).toHaveCount(0);
  await expect(page.getByRole("gridcell", { name: "Delta", exact: true })).toBeVisible();

  // ⌘Z restores the three rows.
  const wrapper = page.locator(".data-table-wrap");
  await wrapper.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(page.getByRole("gridcell", { name: "Alpha", exact: true })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "Bravo", exact: true })).toBeVisible();
  await expect(page.getByRole("gridcell", { name: "Charlie", exact: true })).toBeVisible();

  // Rule 2 — re-select the first three rows, then right-click Delta
  // (outside the selection). Selection clears and the full single-row
  // menu opens against Delta.
  await checkboxes.nth(0).click();
  await checkboxes.nth(1).click();
  await checkboxes.nth(2).click();
  await page.getByRole("gridcell", { name: "Delta", exact: true }).click({ button: "right" });
  const fullMenu = page.getByRole("menu", { name: /Row \d+ actions/ });
  await expect(fullMenu).toBeVisible();
  await expect(fullMenu.getByRole("menuitem", { name: /Insert record/ })).toBeVisible();
  await expect(fullMenu.getByRole("menuitem", { name: /Delete record/ })).toBeVisible();
  // Other rows' checkboxes should be unchecked after the selection
  // clear (rule-2 D-5b irreversibility).
  await expect(checkboxes.nth(0)).not.toBeChecked();
  await expect(checkboxes.nth(1)).not.toBeChecked();
  await expect(checkboxes.nth(2)).not.toBeChecked();
});
