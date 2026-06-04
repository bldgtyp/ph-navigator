import { expect, test } from "@playwright/test";
import { apiUrl, originHeaders, signIn } from "./_helpers";

test.describe.configure({ mode: "serial" });

// Phase 3a — Materials Duplicate happy path. The materials controller
// routes `rowDuplicate` to `POST /materials/{id}/duplicate` and
// invalidates the list query; the new row should appear with the
// expected ` (copy)` suffix. Re-duplicating the same source promotes
// to ` (copy 2)`.

async function seedMaterial(
  request: import("@playwright/test").APIRequestContext,
  baseURL: string | undefined,
  name: string,
): Promise<void> {
  const response = await request.post(apiUrl(baseURL, "/api/v1/catalogs/materials"), {
    headers: originHeaders(baseURL),
    data: {
      name,
      category: "insulation",
      density_kg_m3: 35,
      specific_heat_j_kgk: 1500,
      conductivity_w_mk: 0.034,
      emissivity: 0.9,
      color: "#dce6f0",
      source: null,
      url: null,
      comments: null,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
}

test("materials row context menu — Duplicate creates name (copy) / name (copy 2)", async ({
  page,
  request,
  baseURL,
}) => {
  await signIn(page);

  const unique = `RowDup-${Date.now()}`;
  await seedMaterial(request, baseURL, unique);

  await page.goto("/catalog/materials");
  const sourceCell = page.getByRole("gridcell", { name: unique, exact: true });
  await expect(sourceCell).toBeVisible();

  await sourceCell.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Duplicate record/ }).click();
  await expect(page.getByRole("gridcell", { name: `${unique} (copy)`, exact: true })).toBeVisible({
    timeout: 5_000,
  });

  // Re-duplicate the source — the next free suffix is ` (copy 2)`.
  await sourceCell.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Duplicate record/ }).click();
  await expect(page.getByRole("gridcell", { name: `${unique} (copy 2)`, exact: true })).toBeVisible(
    { timeout: 5_000 },
  );
});
