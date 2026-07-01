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

  // --- Sun study (PRD §12) -------------------------------------------------
  const pill = page.getByRole("button", { name: "Sun study", exact: true });
  await expect(pill).toBeVisible();

  // The pill lives in the Site & Sun lens only.
  await page.getByRole("button", { name: "Building", exact: true }).click();
  await expect(pill).toBeHidden();
  await page.getByRole("button", { name: "Site & Sun" }).click();
  await expect(pill).toBeVisible();

  // Engaging adds a constant number of scene objects (perf gate §12.10). The
  // probe's geometry count is the structural proxy: sun study owns exactly two
  // (marker sphere + catcher plane); the small remaining headroom absorbs
  // first-frame allocations by other helpers. The point is O(1), not O(model).
  const geometriesBefore = await page.evaluate(
    () => window.__phnModelViewerPerf?.geometries ?? 0,
  );
  await pill.click();
  const bar = page.getByRole("region", { name: "Sun study" });
  await expect(bar).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.sunStudy?.engaged)).toBe(
    true,
  );
  // Force a frame so the probe samples the engaged scene.
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, -60);
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewerPerf?.geometries ?? 0))
    .toBeLessThanOrEqual(geometriesBefore + 5);

  // Scrub both axes via the native range inputs; altitude must respond.
  const timeSlider = bar.locator(".sun-study-time");
  await timeSlider.fill("300"); // 05:00 — pre-dawn
  const dawnAltitude = await page.evaluate(
    () => window.__phnModelViewer?.sunStudy?.altitudeDeg ?? null,
  );
  expect(dawnAltitude).not.toBeNull();
  expect(dawnAltitude ?? 0).toBeLessThan(10);
  await timeSlider.fill("720"); // 12:00
  const noonAltitude = await page.evaluate(
    () => window.__phnModelViewer?.sunStudy?.altitudeDeg ?? null,
  );
  expect(noonAltitude ?? 0).toBeGreaterThan(dawnAltitude ?? 0);

  // Preset chips set the date only (time is preserved).
  await bar.getByRole("button", { name: "Dec 21" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.sunStudy?.day))
    .toBe(355);
  expect(await page.evaluate(() => window.__phnModelViewer?.sunStudy?.minutes)).toBe(720);
  const winterNoonAltitude = await page.evaluate(
    () => window.__phnModelViewer?.sunStudy?.altitudeDeg ?? 0,
  );
  expect(winterNoonAltitude).toBeLessThan(noonAltitude ?? 90);

  // Visual record at the winter-noon state.
  await page.screenshot({ path: "test-results/sun-study-winter-noon.png" });

  // Esc collapses back to the pill; scrub state is remembered.
  await page.keyboard.press("Escape");
  await expect(bar).toBeHidden();
  await expect(pill).toBeVisible();
  expect(await page.evaluate(() => window.__phnModelViewer?.sunStudy?.engaged)).toBe(false);
  expect(await page.evaluate(() => window.__phnModelViewer?.sunStudy?.day)).toBe(355);

  // Lens round-trip restores the remembered engaged state machinery.
  await pill.click();
  await expect(bar).toBeVisible();
  await page.getByRole("button", { name: "Building", exact: true }).click();
  await expect(bar).toBeHidden();
  await page.getByRole("button", { name: "Site & Sun" }).click();
  await expect(bar).toBeVisible();
  await expect(bar.getByText("Dec 21 · 12:00")).toBeVisible();
});
