import { expect, test } from "@playwright/test";
import { apiUrl, createProject, originHeaders, signIn } from "./_helpers";
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

test("renders the annual sun path once the project has a location", async ({ page, baseURL }) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  const projectId = await createProject(page, {
    name: `Model Viewer Sun Path ${suffix}`,
    btNumber: `mvsp-${suffix}`,
  });

  // Seed a project location (West Stockbridge, MA) so the project-scoped
  // sun-path endpoint returns a diagram instead of null. `page.request` shares
  // the signed-in session cookies; the Origin header satisfies the TB-01 guard.
  const saved = await page.request.put(apiUrl(baseURL, `/api/v1/projects/${projectId}/location`), {
    headers: originHeaders(baseURL),
    data: {
      latitude: 42.325,
      longitude: -73.367,
      elevation_m: 260,
      true_north_deg: 0,
      time_zone: "America/New_York",
    },
  });
  expect(saved.status(), await saved.text()).toBe(200);

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await page.locator(".model-empty-state input[type=file]").setInputFiles(MODEL_VIEWER_FIXTURE_PATH);
  await waitForModelViewerReady(page);

  await page.getByRole("button", { name: "Site & Sun" }).click();
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.lens)).toBe("site-sun");
  // The diagram replaces the hint exactly when the sun-path query resolves.
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.sunPathReady)).toBe(true);
  await expect(page.getByText("Set project location to see the sun path.")).toBeHidden();
});
