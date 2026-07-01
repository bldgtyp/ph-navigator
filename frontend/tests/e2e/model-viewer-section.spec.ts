import { expect, test } from "@playwright/test";
import { createProject, signIn } from "./_helpers";
import { MODEL_VIEWER_FIXTURE_PATH, waitForModelViewerReady } from "./_modelViewer";

test("clips model geometry with a section plane and restores it on disable", async ({ page }) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Model Viewer Section ${suffix}`,
    btNumber: `mvs-${suffix}`,
  });

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await page
    .locator(".model-empty-state input[type=file]")
    .setInputFiles(MODEL_VIEWER_FIXTURE_PATH);
  await waitForModelViewerReady(page);

  const sectionButton = page.getByRole("button", { name: "Enable section plane" });
  await sectionButton.click();
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.section?.axis)).toBe("z");

  await page.evaluate(() => window.__phnModelViewer?.setSection({ axis: "z", offset: -1000 }));
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.sectionClippedObjectIds().length ?? 0))
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Spaces" }).click();
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.section?.axis)).toBe("z");

  await page.getByRole("button", { name: "Disable section plane" }).click();
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.section ?? null)).toBeNull();
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.sectionClippedObjectIds().length ?? 0))
    .toBe(0);
});
