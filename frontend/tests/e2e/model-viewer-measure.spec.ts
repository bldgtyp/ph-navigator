import { expect, test } from "@playwright/test";
import { stripTrailingZeros } from "../../src/lib/units/format";
import { formatFeetInches } from "../../src/lib/units/length/formatFeetInches";
import { createProject, signIn } from "./_helpers";
import { MODEL_VIEWER_FIXTURE_PATH, selectAnyModelObject, waitForModelViewerReady } from "./_modelViewer";

test("measures a known model edge in both unit systems and clears on exit/lens switch", async ({
  page,
}) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Model Viewer Measure ${suffix}`,
    btNumber: `mvm-${suffix}`,
  });

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await page.locator(".model-empty-state input[type=file]").setInputFiles(MODEL_VIEWER_FIXTURE_PATH);
  await waitForModelViewerReady(page);

  await page.getByRole("radio", { name: "Set display units to SI" }).click();
  const faceId = await selectAnyModelObject(page, "faceMesh");
  await page.keyboard.press("Escape");

  const distanceM = await page.evaluate((objectId) => {
    const line = window.__phnModelViewer?.measureBetweenVertices(objectId, 0, 1);
    return line?.distanceM ?? null;
  }, faceId);
  expect(distanceM).toBeGreaterThan(0);
  await expect(page.locator(".model-measure-label")).toHaveText(formatSi(distanceM!));

  await page.getByRole("radio", { name: "Set display units to IP" }).click();
  await expect(page.locator(".model-measure-label")).toHaveText(formatIp(distanceM!));

  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.measureActive)).toBe(false);
  await expect(page.locator(".model-measure-label")).toHaveCount(0);

  await page.evaluate((objectId) => window.__phnModelViewer?.measureBetweenVertices(objectId, 0, 1), faceId);
  await expect(page.locator(".model-measure-label")).toHaveCount(1);
  await page.getByRole("button", { name: "Spaces" }).click();
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.measureActive)).toBe(false);
  await expect(page.locator(".model-measure-label")).toHaveCount(0);
});

function formatSi(distanceM: number): string {
  return `${stripTrailingZeros(distanceM.toFixed(2))} m`;
}

function formatIp(distanceM: number): string {
  return formatFeetInches(distanceM * 1000);
}
