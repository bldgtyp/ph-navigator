import { expect, test } from "@playwright/test";
import {
  FRAME_TYPES_PATH,
  apiUrl,
  createProject,
  deactivateCatalogRow,
  originHeaders,
  readWindowTypesSlice,
  seedCatalog,
  signIn,
  updateCatalogRow,
} from "./_helpers";

test.describe.configure({ mode: "serial" });

test("editor reviews all window catalog drift and applies one slot refresh", async ({
  page,
  baseURL,
}) => {
  await signIn(page);

  const stamp = Date.now().toString().slice(-8);
  const frameName = `E2E Refresh Frame ${stamp}`;
  const headers = originHeaders(baseURL);
  let frameId: string | null = null;

  try {
    frameId = await seedCatalog(page.request, apiUrl(baseURL, FRAME_TYPES_PATH), headers, {
      name: frameName,
      manufacturer: "Skyline",
      brand: "Ridge",
      width_mm: 82,
      u_value_w_m2k: 0.95,
      psi_g_w_mk: 0.038,
      psi_install_w_mk: 0.04,
      notes: "original",
    });

    const projectId = await createProject(page, {
      name: `Windows TB-09 ${stamp}`,
      btNumber: `win-refresh-${stamp}`,
    });

    await page.goto(`/projects/${projectId}/windows`);
    await page.getByRole("button", { name: "Add window type" }).click();
    await page.getByLabel("Frame · top").selectOption(frameName);
    await expect(page.getByTestId("frame-top-catalog-origin")).toBeVisible();
    await page.getByLabel("Frame top U-value").fill("0.85");
    await page.keyboard.press("Tab");
    await expect(page.locator(".override-badge").first()).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);

    await updateCatalogRow(page.request, apiUrl(baseURL, FRAME_TYPES_PATH), frameId, headers, {
      u_value_w_m2k: 0.72,
      notes: `updated ${stamp}`,
    });

    await page.reload();
    await expect(page.getByText(/(entry|entries) drifted from catalog/)).toBeVisible();
    await page.getByRole("button", { name: "Review all" }).first().click();
    await expect(page.getByRole("heading", { name: "Catalog Refresh Report" })).toBeVisible();
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review catalog refresh" })).toBeVisible();

    const uValueRow = page.locator("fieldset").filter({ hasText: "u_value_w_m2k" });
    await expect(uValueRow.getByLabel("Keep mine")).toBeChecked();
    const notesRow = page.locator("fieldset").filter({ hasText: "notes" });
    await expect(notesRow.getByLabel("Update from catalog")).toBeChecked();

    await page.getByRole("button", { name: "Apply" }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel("Frame top U-value")).toHaveValue("0.85");
    await expect(page.locator(".override-badge").first()).toBeVisible();

    const slice = await readWindowTypesSlice(page.request, baseURL, projectId);
    const frame = slice.window_types[0].elements[0].frames.top;
    expect(frame.u_value_w_m2k).toBeCloseTo(0.85, 5);
    expect(frame.notes).toBe(`updated ${stamp}`);
    expect(frame.catalog_origin.local_overrides).toEqual(["u_value_w_m2k"]);
  } finally {
    if (frameId)
      await deactivateCatalogRow(page.request, apiUrl(baseURL, FRAME_TYPES_PATH), frameId, headers);
  }
});
