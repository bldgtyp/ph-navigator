import { expect, test } from "@playwright/test";
import { createProject, signIn } from "./_helpers";

test.describe.configure({ mode: "serial" });

// Phase 3b — Rooms Duplicate happy path. Slice-replace consumers
// clone the source row client-side and dispatch the existing
// PUT /draft/tables/rooms write. The `(copy)` suffix is applied to
// `custom_values["name"]`. ⌘Z should remove the clone cleanly.

test("rooms row context menu — Duplicate clones with (copy) suffix; ⌘Z removes it", async ({
  page,
}) => {
  await signIn(page);
  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Rooms Dup ${suffix}`,
    btNumber: `rd-${suffix}`,
  });
  await page.getByRole("link", { name: "Rooms" }).click();
  await expect(page.getByRole("region", { name: "Rooms" })).toBeVisible();

  await page.getByRole("button", { name: "Add New Room" }).click();
  const dialog = page.getByRole("dialog", { name: "New room" });
  await dialog.getByLabel("Number").fill("101");
  await dialog.getByLabel("Name").fill("Living");
  await dialog.getByLabel("Floor level").fill("Ground");
  await dialog.getByLabel("Building zone").fill("Residential");
  await dialog.getByRole("button", { name: "Save room" }).click();

  const sourceCell = page.getByRole("gridcell", { name: "Living", exact: true });
  await expect(sourceCell).toBeVisible();
  await sourceCell.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Duplicate record/ }).click();

  await expect(page.getByRole("gridcell", { name: "Living (copy)", exact: true })).toBeVisible({
    timeout: 5_000,
  });

  // ⌘Z removes the clone — slice-replace consumers have no tmp-id ↔
  // real-id reconcile gap because the tmp id is the persisted id.
  const wrapper = page.locator(".data-table-wrap");
  await wrapper.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  await expect(page.getByRole("gridcell", { name: "Living (copy)", exact: true })).toHaveCount(0);
});
