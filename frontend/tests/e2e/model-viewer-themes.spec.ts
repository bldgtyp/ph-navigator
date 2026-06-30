import { expect, test, type Page } from "@playwright/test";
import { createProject, signIn } from "./_helpers";
import {
  MODEL_VIEWER_FIXTURE_PATH,
  selectAnyModelObject,
  waitForModelViewerReady,
} from "./_modelViewer";

test("switches model themes, shows legends, and honors theme deep links", async ({ page }) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  const projectId = await createProject(page, {
    name: `Model Viewer Themes ${suffix}`,
    btNumber: `mvt-${suffix}`,
  });

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await page
    .locator(".model-empty-state input[type=file]")
    .setInputFiles(MODEL_VIEWER_FIXTURE_PATH);
  await waitForModelViewerReady(page);

  await chooseTheme(page, "Boundary");
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.theme)).toBe("boundary");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.legend?.rows))
    .toEqual([
      { id: "Outdoors", label: "Outdoors", color: "#40B4FF", count: 12 },
      { id: "Ground", label: "Ground", color: "#A55200", count: 7 },
      { id: "Surface", label: "Surface", color: "#008000", count: 6 },
    ]);

  const selectedFace = await selectAnyModelObject(page, "faceMesh");
  await chooseTheme(page, "Construction");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId))
    .toBe(selectedFace);
  await expect
    .poll(() =>
      page.evaluate(
        (objectId) => window.__phnModelViewer?.themeColorForObject(objectId),
        selectedFace,
      ),
    )
    .toMatch(/^#[0-9a-f]{6}$/);
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null))
    .toBeNull();

  await switchLens(page, "Floor Areas");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.theme))
    .toBe("weighting-factor");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.legend?.rows))
    .toEqual([{ id: "FullyTreated", label: "Fully Treated", color: "#F5E470", count: 5 }]);

  await switchLens(page, "Ventilation");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.legend?.rows))
    .toEqual([
      { id: "duct-supply", label: "Supply", color: "#2674d9", count: 3 },
      { id: "duct-exhaust", label: "Exhaust", color: "#d94a3a", count: 2 },
    ]);

  await expect(page.getByRole("button", { name: "Collapse legend" })).toHaveCount(0);
  await expect(page.locator(".model-legend-rows")).toBeVisible();
  await switchLens(page, "Spaces");
  await switchLens(page, "Ventilation");
  await expect(page.locator(".model-legend-rows")).toBeVisible();

  const fileId = new URL(page.url()).searchParams.get("file");
  expect(fileId).toBeTruthy();
  await page.goto(`/projects/${projectId}/model?file=${fileId}&lens=building&theme=boundary`);
  await waitForModelViewerReady(page);
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.theme)).toBe("boundary");
  await expect(page).toHaveURL(/[?&]theme=boundary/);
});

async function chooseTheme(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /^Color:/ }).click();
  await page.getByRole("menuitemcheckbox", { name, exact: true }).click();
}

async function switchLens(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name }).click();
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null))
    .toBeNull();
}
