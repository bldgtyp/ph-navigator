import { expect, test } from "@playwright/test";
import { createProject, signIn } from "./_helpers";
import { MODEL_VIEWER_FIXTURE_PATH, selectAnyModelObject, waitForModelViewerReady } from "./_modelViewer";

test("renders Site & Sun with non-selectable shades and the location hint", async ({ page }) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  const projectId = await createProject(page, {
    name: `Model Viewer Site Sun ${suffix}`,
    btNumber: `mvss-${suffix}`,
  });

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await page.locator(".model-empty-state input[type=file]").setInputFiles(MODEL_VIEWER_FIXTURE_PATH);
  await waitForModelViewerReady(page);

  await expect(page.getByRole("button", { name: "Site & Sun" })).toBeEnabled();
  await page.getByRole("button", { name: "Site & Sun" }).click();
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.lens)).toBe("site-sun");
  await expect(page.getByText("Set project location to see the sun path.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.shadeCount)).toBe(5);
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.sunPathReady)).toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.visibleObjectIds.some((id) => id.startsWith("shade:"))))
    .toBe(false);

  await selectAnyModelObject(page, "faceMesh");
  await expect(page.getByLabel("Selected model element")).toContainText("Opaque Surface");

  const fileId = new URL(page.url()).searchParams.get("file");
  expect(fileId).toBeTruthy();
  await page.goto(`/projects/${projectId}/model?file=${fileId}&lens=site-sun`);
  await waitForModelViewerReady(page);
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.lens)).toBe("site-sun");
  await expect(page).toHaveURL(/[?&]lens=site-sun/);
});
