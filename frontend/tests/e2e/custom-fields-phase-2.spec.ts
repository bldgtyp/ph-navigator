import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { createProject, openHeaderMenu, signIn } from "./_helpers";

const SCREENSHOT_DIR = "../docs/plans/2026-05-24/screenshots/custom-fields-phase-2";

test.describe.configure({ mode: "serial" });

test("custom-field Phase 2 editor walkthrough", async ({ page }) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await signIn(page);

  const btNumber = `cf2-${Date.now().toString().slice(-8)}`;
  await createProject(page, { name: `Custom Fields ${btNumber}`, btNumber });
  await page.getByRole("link", { name: "Rooms" }).click();
  await expect(page.getByRole("region", { name: "Rooms" })).toBeVisible();

  await page.getByRole("button", { name: "Add field" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add field" });
  await addDialog.getByLabel("Field name").fill("Paint");
  await addDialog.getByLabel("Add description").check();
  await addDialog.getByLabel("Field description").fill("Paint finish notes");
  await addDialog.getByRole("button", { name: /Add field/ }).click();
  await expect(page.getByRole("columnheader", { name: /^Paint\b/ })).toBeVisible();
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01-added-field.png`, fullPage: false });

  await openHeaderMenu(page, "Paint");
  await page.getByRole("menuitem", { name: "Edit field…" }).click();
  const editDialog = page.getByRole("dialog", { name: /Edit field/ });
  await editDialog.getByLabel("Name").fill("Finish");
  await editDialog.getByRole("button", { name: "Save" }).click();
  await expect(editDialog).toBeHidden();
  await expect(page.getByRole("columnheader", { name: /^Finish\b/ })).toBeVisible();

  await openHeaderMenu(page, "Finish");
  await page.getByRole("menuitem", { name: "Duplicate field" }).click();
  await expect(page.getByRole("columnheader", { name: /^Finish copy\b/ })).toBeVisible();

  await page.getByRole("button", { name: "Description for Finish", exact: true }).focus();
  await expect(page.getByRole("tooltip")).toContainText("Paint finish notes");
  await page.screenshot({ path: `${SCREENSHOT_DIR}/02-description-tooltip.png`, fullPage: false });

  await openHeaderMenu(page, "Finish copy");
  await page.getByRole("menuitem", { name: "Delete field" }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toContainText("Delete field");
  await deleteDialog.getByRole("button", { name: "Delete field" }).click();
  await expect(page.getByRole("columnheader", { name: /^Finish copy\b/ })).toHaveCount(0);
});
