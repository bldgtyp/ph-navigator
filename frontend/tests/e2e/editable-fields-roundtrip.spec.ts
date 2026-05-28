import { expect, test } from "@playwright/test";
import { addShortTextField, createProject, openHeaderMenu, signIn } from "./_helpers";

test.describe.configure({ mode: "serial" });

test("editable Rooms and Pumps fields round-trip through the browser", async ({ page }) => {
  await signIn(page);

  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Editable Fields ${suffix}`,
    btNumber: `ef-${suffix}`,
  });

  await page.getByRole("link", { name: "Rooms" }).click();
  await expect(page.getByRole("region", { name: "Rooms" })).toBeVisible();

  await addShortTextField(page, "Browser Note");
  await expect(page.getByRole("columnheader", { name: /^Browser Note\b/ })).toBeVisible();

  await page.getByRole("button", { name: "Add New Room" }).click();
  const roomDialog = page.getByRole("dialog", { name: "New room" });
  await roomDialog.getByLabel("Number").fill("201");
  await roomDialog.getByLabel("Name").fill("Browser Room");
  await roomDialog.getByLabel("Floor level").fill("Ground");
  await roomDialog.getByLabel("Building zone").fill("Residential");
  await roomDialog.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByRole("gridcell", { name: "Browser Room", exact: true })).toBeVisible();

  const browserNoteHeader = page.getByRole("columnheader", { name: /^Browser Note\b/ });
  const browserNoteColumnIndex = await browserNoteHeader.getAttribute("aria-colindex");
  if (!browserNoteColumnIndex) throw new Error("Browser Note column is missing aria-colindex");
  const browserRoomRow = page.getByRole("row").filter({
    has: page.getByRole("gridcell", { name: "Browser Room", exact: true }),
  });
  await browserRoomRow.locator(`td[aria-colindex="${browserNoteColumnIndex}"]`).dblclick();
  await page.keyboard.type("round-tripped room note");
  await page.keyboard.press("Enter");
  await expect(page.getByText("round-tripped room note")).toBeVisible();

  await openHeaderMenu(page, "Number");
  await page.getByRole("menuitem", { name: "Edit field…" }).click();
  const editNumberDialog = page.getByRole("dialog", { name: /Edit field/ });
  await editNumberDialog.getByRole("radio", { name: "Number" }).click();
  await editNumberDialog.getByRole("button", { name: "Save" }).click();
  await expect(editNumberDialog).toBeHidden();
  await expect(page.getByRole("gridcell", { name: "201", exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "Rooms" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /^Browser Note\b/ })).toBeVisible();
  await expect(page.getByText("round-tripped room note")).toBeVisible();

  await page.getByRole("link", { name: "Equipment" }).click();
  await expect(page.getByRole("region", { name: "Equipment" })).toBeVisible();
  await page.getByRole("button", { name: "Add pump" }).click();
  await page.locator('td[data-field-key="record_id"]').first().dblclick();
  await page.keyboard.type("P-BROWSER");
  await page.keyboard.press("Enter");
  await expect(page.getByText("P-BROWSER")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("region", { name: "Equipment" })).toBeVisible();
  await expect(page.getByText("P-BROWSER")).toBeVisible();
});
