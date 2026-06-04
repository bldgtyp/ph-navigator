import { expect, test } from "@playwright/test";
import { createProject, signIn } from "./_helpers";

test.describe.configure({ mode: "serial" });

// Phase 3c — Pumps Duplicate happy path. Pumps re-sort after every
// insert/duplicate, so the clone is asserted by name rather than by
// row position. The `(copy)` suffix is applied to
// `custom_values["record_id"]`.

test("pumps row context menu — Duplicate clones with record_id (copy)", async ({ page }) => {
  await signIn(page);
  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Pumps Dup ${suffix}`,
    btNumber: `pd-${suffix}`,
  });

  await page.getByRole("link", { name: "Equipment" }).click();
  await expect(page.getByRole("region", { name: "Equipment" })).toBeVisible();

  await page.getByRole("button", { name: "Add pump" }).click();
  await page.locator('td[data-field-key="record_id"]').first().dblclick();
  await page.keyboard.type("P-1");
  await page.keyboard.press("Enter");
  const sourceCell = page.getByRole("gridcell", { name: "P-1", exact: true });
  await expect(sourceCell).toBeVisible();

  await sourceCell.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Duplicate record/ }).click();

  await expect(page.getByRole("gridcell", { name: "P-1 (copy)", exact: true })).toBeVisible({
    timeout: 5_000,
  });
});
