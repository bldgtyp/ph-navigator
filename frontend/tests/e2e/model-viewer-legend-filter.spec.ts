import { expect, test, type Page } from "@playwright/test";
import { createProject, signIn } from "./_helpers";
import { MODEL_VIEWER_FIXTURE_PATH, waitForModelViewerReady } from "./_modelViewer";

test("isolates a legend bucket as a filter and restores on clear / Escape", async ({ page }) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Model Viewer Legend Filter ${suffix}`,
    btNumber: `mvlf-${suffix}`,
  });

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await page
    .locator(".model-empty-state input[type=file]")
    .setInputFiles(MODEL_VIEWER_FIXTURE_PATH);
  await waitForModelViewerReady(page);

  await chooseTheme(page, "Boundary");
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.theme)).toBe("boundary");

  const baseline = await visibleCount(page);
  const outdoorsCount = await page.evaluate(
    () => window.__phnModelViewer?.legend?.rows.find((row) => row.id === "Outdoors")?.count ?? 0,
  );
  expect(outdoorsCount).toBeGreaterThan(0);
  expect(baseline).toBeGreaterThan(outdoorsCount);

  const outdoorsRow = page.locator(".model-legend-rows button").filter({ hasText: "Outdoors" });
  await outdoorsRow.click();

  // The clicked row reads as active and only its bucket stays in the visible set
  // (other boundaries + apertures drop out; their edges remain as wireframe).
  await expect(outdoorsRow).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.legendFilter))
    .toEqual({ theme: "boundary", keys: ["Outdoors"] });
  await expect.poll(() => visibleCount(page)).toBe(outdoorsCount);

  // Clear-filter control restores the full set.
  await page.getByRole("button", { name: "Clear filter" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.legendFilter ?? null))
    .toBeNull();
  await expect(outdoorsRow).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => visibleCount(page)).toBe(baseline);

  // Re-filter, then Escape clears it.
  await outdoorsRow.click();
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.legendFilter ?? null))
    .not.toBeNull();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.legendFilter ?? null))
    .toBeNull();
  await expect.poll(() => visibleCount(page)).toBe(baseline);
});

function visibleCount(page: Page): Promise<number> {
  return page.evaluate(() => window.__phnModelViewer?.visibleObjectIds.length ?? 0);
}

async function chooseTheme(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: /^Color:/ }).click();
  await page.getByRole("menuitemcheckbox", { name, exact: true }).click();
}
