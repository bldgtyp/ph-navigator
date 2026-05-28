import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { addShortTextField, createProject, openHeaderMenu, signIn } from "./_helpers";

// Plan-17 P4.10 — exit-criteria Playwright walkthrough for the
// formula custom-field UX against a running dev stack. Mirrors the
// scope of `custom-fields-phase-2.spec.ts` but exercises the
// Phase 4 gestures: add a formula via the AddField popover, observe
// the computed overlay in the grid, open the unified field editor, duplicate
// the formula, and delete a referenced custom field to surface the
// `missing_ref` overlay.
//
// Screenshots land under
// `docs/plans/2026-05-25/screenshots/plan-17-p4-10/`.

const SCREENSHOT_DIR = "../docs/plans/2026-05-25/screenshots/plan-17-p4-10";

test.describe.configure({ mode: "serial" });

test("custom-fields Phase 4 formula walkthrough", async ({ page }) => {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await signIn(page);

  const btNumber = `cf4-${Date.now().toString().slice(-8)}`;
  await createProject(page, { name: `Custom Fields Phase 4 ${btNumber}`, btNumber });
  await page.getByRole("link", { name: "Rooms" }).click();
  await expect(page.getByRole("region", { name: "Rooms" })).toBeVisible();

  // 1. Seed a Tag short_text field so a later step can reference it
  //    from a formula and observe missing_ref when Tag is deleted.
  await addShortTextField(page, "Tag");
  await expect(page.getByRole("columnheader", { name: /^Tag\b/ })).toBeVisible();

  // 2. Add a formula field "Label" via the AddField popover.
  await page.getByRole("button", { name: "Add field" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add field" });
  await addDialog.getByLabel("Field name").fill("Label");
  await addDialog.getByRole("radio", { name: "Formula" }).click();
  await addDialog.getByLabel("Expression").fill('concat({Number}, " — ", upper({Name}))');
  await addDialog.getByRole("button", { name: /Add field/ }).click();
  await expect(page.getByRole("columnheader", { name: /^Label\b/ })).toBeVisible();
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/01-formula-column-added.png`,
    fullPage: false,
  });

  // 3. Open Edit field… from the header context menu and confirm
  //    the modal seeds the stored formula source.
  const editDialog = await openFieldConfigDialog(page, "Label");
  await expect(editDialog.getByLabel("Expression")).toHaveValue(
    'concat({Number}, " — ", upper({Name}))',
  );
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/02-edit-formula-modal.png`,
    fullPage: false,
  });
  await page.keyboard.press("Escape");

  // 4. Duplicate the formula field via the header context menu.
  await openHeaderMenu(page, "Label");
  await page.getByRole("menuitem", { name: "Duplicate field" }).click();
  await expect(page.getByRole("columnheader", { name: /^Label copy\b/ })).toBeVisible();

  // 5. Replace Label's source so it now references Tag, then delete
  //    Tag and observe the missing_ref overlay on Label.
  const editDialog2 = await openFieldConfigDialog(page, "Label");
  const expr = editDialog2.getByLabel("Expression");
  await expr.fill('concat({Tag}, "-", {Name})');
  await editDialog2.getByRole("button", { name: "Save" }).click();
  await expect(editDialog2).toBeHidden();

  await openHeaderMenu(page, "Tag");
  await page.getByRole("menuitem", { name: "Delete field" }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toContainText("Delete field");
  await deleteDialog.getByRole("button", { name: "Delete field" }).click();
  await expect(page.getByRole("columnheader", { name: /^Tag\b/ })).toHaveCount(0);
  await expect(
    page.getByLabel(/Formula error: Formula references a field that no longer exists/),
  ).toBeVisible();
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/03-missing-ref-overlay.png`,
    fullPage: false,
  });

  // 6. Recover by editing Label back to a valid expression.
  const recoverDialog = await openFieldConfigDialog(page, "Label");
  await recoverDialog.getByLabel("Expression").fill("upper({Name})");
  await recoverDialog.getByRole("button", { name: "Save" }).click();
  await expect(recoverDialog).toBeHidden();
  await expect(
    page.getByLabel(/Formula error: Formula references a field that no longer exists/),
  ).toHaveCount(0);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/04-recovered.png`,
    fullPage: false,
  });
});

async function openFieldConfigDialog(page: Page, fieldName: string) {
  await openHeaderMenu(page, fieldName);
  await page.getByRole("menuitem", { name: "Edit field…" }).click();
  return page.getByRole("dialog", { name: /Edit field/ });
}
