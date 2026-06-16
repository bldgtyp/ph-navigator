import { expect, test } from "@playwright/test";
import { createProject, openRoomsTable, signIn } from "./_helpers";

test.describe.configure({ mode: "serial" });

// Phase 1 row-context-menu shell — covers the three gesture surfaces
// that don't depend on Duplicate / multi-row collapse / extension
// slot (Phases 2 / 3 / 4):
//   1. Right-click on a data row opens the menu and surfaces
//      Insert / Expand / Delete.
//   2. Right-clicking inside an open inline editor falls through to
//      the browser's native context menu.
//   3. Shift+F10 on the row's gutter number button opens the menu.

test("row context menu — gesture surfaces", async ({ page }) => {
  await signIn(page);
  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Row Menu ${suffix}`,
    btNumber: `rm-${suffix}`,
  });

  await openRoomsTable(page);

  // Seed one row so the body has a target to right-click.
  await page.getByRole("button", { name: "Add New Room" }).click();
  const roomDialog = page.getByRole("dialog", { name: "New room" });
  await roomDialog.getByLabel("Number").fill("101");
  await roomDialog.getByLabel("Name").fill("Menu Row");
  await roomDialog.getByLabel("Floor level").fill("Ground");
  await roomDialog.getByLabel("Building zone").fill("Residential");
  await roomDialog.getByRole("button", { name: "Save room" }).click();
  const menuRowCell = page.getByRole("gridcell", { name: "Menu Row", exact: true });
  await expect(menuRowCell).toBeVisible();

  // 1. Right-click opens the menu with three items.
  await menuRowCell.click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const items = menu.getByRole("menuitem");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Insert record");
  await expect(items.nth(1)).toContainText("Expand record");
  await expect(items.nth(2)).toContainText("Delete record");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();

  // 2. Right-click inside an open inline editor does not open the
  //    custom menu — the browser's native menu surfaces instead.
  await menuRowCell.dblclick();
  const editor = page.locator(".data-table-cell-editor");
  await expect(editor).toBeVisible();
  await editor.click({ button: "right" });
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // 3. Shift+F10 on the row's gutter number button opens the menu.
  const gutterButton = page.locator(".data-table-gutter-number").filter({ hasText: /^1$/ }).first();
  await gutterButton.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
});
