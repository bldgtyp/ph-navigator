import { expect, test } from "@playwright/test";
import {
  FRAME_TYPES_PATH,
  FRAME_TYPES_TABLE,
  GLAZING_TYPES_PATH,
  GLAZING_TYPES_TABLE,
  createProject,
  deactivateCatalogRow,
  originHeaders,
  seedCatalog,
  signIn,
} from "./_helpers";

// TB-08.c happy path: editor seeds a Frame + Glazing catalog row via API,
// creates a project, opens Windows, picks frame/glazing into a 1x1 element,
// edits the frame U-value as the override tracer, saves, reloads, and
// confirms the catalog_origin badges, override badge, U-values, and
// persisted local_overrides round-trip through the backend. Catalog rows
// are deactivated in `finally` so repeated runs do not pollute the firm-
// global Frame / Glazing catalogs.

test.describe.configure({ mode: "serial" });

test("editor picks frame and glazing into a window type and the override tracer persists", async ({
  page,
  baseURL,
}) => {
  await signIn(page);

  const stamp = Date.now().toString().slice(-8);
  const frameName = `E2E Frame ${stamp}`;
  const glazingName = `E2E Glazing ${stamp}`;
  const headers = originHeaders(baseURL);
  let frameId: string | null = null;
  let glazingId: string | null = null;

  try {
    // Seed catalogs through the API so the spec stays focused on the
    // picker / override / save flow. TB-08.a covers the catalog UI itself.
    frameId = await seedCatalog(page.request, FRAME_TYPES_PATH, headers, {
      name: frameName,
      manufacturer: "Skyline",
      brand: "Ridge",
      width_mm: 82,
      u_value_w_m2k: 0.95,
      psi_g_w_mk: 0.038,
      psi_install_w_mk: 0.04,
    });
    glazingId = await seedCatalog(page.request, GLAZING_TYPES_PATH, headers, {
      name: glazingName,
      manufacturer: "Cardinal",
      brand: "LoE-366",
      u_value_w_m2k: 0.6,
      g_value: 0.5,
    });

    const projectId = await createProject(page, {
      name: `Windows TB-08c ${stamp}`,
      btNumber: `win-${stamp}`,
    });

    await page.goto(`/projects/${projectId}/windows`);
    await expect(page.getByRole("heading", { name: "Windows", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "Add window type" }).click();
    await expect(page.getByText("Unsaved Window Types draft restored")).toBeVisible();
    await expect(page.getByRole("button", { name: "Unnamed Window Type" })).toBeVisible();

    // Wait for the frame draft to settle before picking glazing — concurrent
    // slice writes would otherwise hit a stale ETag.
    await page.getByLabel("Frame · top").selectOption(frameName);
    await expect(page.getByTestId("frame-top-catalog-origin")).toBeVisible();
    await expect(page.getByLabel("Frame top U-value")).toHaveValue("0.95");

    await page.getByLabel("Glazing", { exact: true }).selectOption(glazingName);
    await expect(page.getByTestId("glazing-catalog-origin")).toBeVisible();
    await expect(page.getByLabel("Glazing U-value")).toHaveValue("0.6");

    await page.getByLabel("Frame top U-value").fill("0.85");
    await page.keyboard.press("Tab");
    await expect(page.locator(".override-badge").first()).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Unsaved Window Types draft restored")).toHaveCount(0);
    await expect(page.getByText("Clean")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Unnamed Window Type" })).toBeVisible();
    await expect(page.getByTestId("frame-top-catalog-origin")).toBeVisible();
    await expect(page.getByTestId("glazing-catalog-origin")).toBeVisible();
    await expect(page.getByLabel("Frame top U-value")).toHaveValue("0.85");
    await expect(page.getByLabel("Glazing U-value")).toHaveValue("0.6");
    await expect(page.locator(".override-badge").first()).toBeVisible();

    const slice = await page.evaluate(async (id: string) => {
      const detailResponse = await fetch(`/api/v1/projects/${id}`, { credentials: "include" });
      const detail = await detailResponse.json();
      const versionId = detail.active_version_id;
      const tableResponse = await fetch(
        `/api/v1/projects/${id}/versions/${versionId}/document/tables/window_types`,
        { credentials: "include" },
      );
      return tableResponse.json();
    }, projectId);
    expect(slice.window_types).toHaveLength(1);
    const element = slice.window_types[0].elements[0];
    expect(element.frames.top.u_value_w_m2k).toBeCloseTo(0.85, 5);
    expect(element.frames.top.catalog_origin.catalog_table).toBe(FRAME_TYPES_TABLE);
    expect(element.frames.top.catalog_origin.local_overrides).toEqual(["u_value_w_m2k"]);
    expect(element.glazing.u_value_w_m2k).toBeCloseTo(0.6, 5);
    expect(element.glazing.catalog_origin.catalog_table).toBe(GLAZING_TYPES_TABLE);
    expect(element.glazing.catalog_origin.local_overrides).toEqual([]);
  } finally {
    if (frameId) await deactivateCatalogRow(page.request, FRAME_TYPES_PATH, frameId, headers);
    if (glazingId) await deactivateCatalogRow(page.request, GLAZING_TYPES_PATH, glazingId, headers);
  }
});
