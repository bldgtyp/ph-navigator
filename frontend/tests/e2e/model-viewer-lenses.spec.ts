import { expect, test } from "@playwright/test";
import { createProject, signIn } from "./_helpers";
import {
  MODEL_VIEWER_FIXTURE_PATH,
  modelViewerObjectCount,
  selectAnyModelObject,
  waitForModelViewerReady,
} from "./_modelViewer";

test("switches model lenses, selects lens objects, and honors lens deep links", async ({
  page,
}) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  const projectId = await createProject(page, {
    name: `Model Viewer Lenses ${suffix}`,
    btNumber: `mvl-${suffix}`,
  });

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await page
    .locator(".model-empty-state input[type=file]")
    .setInputFiles(MODEL_VIEWER_FIXTURE_PATH);
  await waitForModelViewerReady(page);

  await expect.poll(() => modelViewerObjectCount(page, "spaceGroup")).toBe(4);
  await expect.poll(() => modelViewerObjectCount(page, "spaceFloorSegmentMeshFace")).toBe(5);
  await expect.poll(() => modelViewerObjectCount(page, "ductSegmentLine")).toBe(5);
  await expect.poll(() => modelViewerObjectCount(page, "pipeSegmentLine")).toBe(4);

  await switchLens(page, "Spaces");
  await selectAnyModelObject(page, "spaceGroup");
  await expect(page.getByLabel("Selected model element")).toContainText("Interior Space");

  await switchLens(page, "Floor Areas");
  await selectAnyModelObject(page, "spaceFloorSegmentMeshFace");
  await expect(page.getByLabel("Selected model element")).toContainText("Interior Floor");

  await switchLens(page, "Ventilation");
  const ductSegmentId = await selectAnyModelObject(page, "ductSegmentLine");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null))
    .toBe(`element:${ductSegmentId.slice(0, ductSegmentId.lastIndexOf(":"))}`);
  await expect(page.getByLabel("Selected model element")).toContainText("Duct Element");
  await expect(page.getByLabel("Selected model element")).toContainText("Total Length");
  await expect(page.getByLabel("Selected model element")).toContainText(/segments?/);

  await switchLens(page, "Hot Water");
  const pipeElement = await selectMultiSegmentElement(page, "pipe");
  const pipeSegmentId = pipeElement.segmentIds[0];
  if (!pipeSegmentId) throw new Error("Selected pipe element has no segments.");
  await page.evaluate(
    (segmentId) => window.__phnModelViewer?.selectObject(segmentId),
    pipeSegmentId,
  );
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null))
    .toBe(pipeElement.elementId);
  await expect(page.getByLabel("Selected model element")).toContainText("Pipe Element");
  await expect(page.getByLabel("Selected model element")).toContainText("Total Length");
  await expect(page.getByLabel("Selected model element")).toContainText(/segments?/);
  const focusedSegmentId = pipeElement.segmentIds[1] ?? pipeSegmentId;
  const focusedRowIndex = pipeElement.segmentIds.indexOf(focusedSegmentId) + 1;
  const focusedRow = page.getByRole("button", { name: new RegExp(`^${focusedRowIndex}\\s`) });
  await page.evaluate(
    (segmentId) => window.__phnModelViewer?.setHoverId(segmentId),
    focusedSegmentId,
  );
  await expect(focusedRow).toHaveClass(/is-hovered/);
  await focusedRow.click();
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.focusedSegmentId ?? null))
    .toBe(focusedSegmentId);
  await expect
    .poll(() =>
      page.evaluate(
        (segmentId) => window.__phnModelViewer?.lineHighlightTierForObject(segmentId),
        focusedSegmentId,
      ),
    )
    .toBe("focused");
  await expect(page.getByLabel("Selected model element")).toContainText("Water Temp");
  await orbitModelViewer(page);
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.focusedSegmentId ?? null))
    .toBe(focusedSegmentId);

  await switchLens(page, "Site & Sun");
  await expect(page.getByText("Set project location to see the sun path.")).toBeVisible();

  const fileId = new URL(page.url()).searchParams.get("file");
  expect(fileId).toBeTruthy();
  await page.goto(`/projects/${projectId}/model?file=${fileId}&lens=ventilation`);
  await waitForModelViewerReady(page);
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.lens)).toBe("ventilation");
  await expect(page).toHaveURL(/[?&]lens=ventilation/);
});

async function switchLens(page: import("@playwright/test").Page, name: string): Promise<void> {
  await page.getByRole("button", { name }).click();
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null))
    .toBeNull();
}

async function selectMultiSegmentElement(
  page: import("@playwright/test").Page,
  family: "duct" | "pipe",
): Promise<{ elementId: string; segmentIds: string[] }> {
  const element = await page.evaluate((prefix) => {
    const viewer = window.__phnModelViewer;
    if (!viewer) throw new Error("Model viewer object hook is not ready.");
    const candidates = viewer.elementIds
      .filter((id) => id.startsWith(`element:${prefix}:`))
      .map((elementId) => ({ elementId, segmentIds: viewer.segmentIdsForElement(elementId) }))
      .filter((candidate) => candidate.segmentIds.length > 0);
    return candidates.find((candidate) => candidate.segmentIds.length > 1) ?? candidates[0] ?? null;
  }, family);
  expect(element).toBeTruthy();
  if (!element) throw new Error(`No ${family} element was found.`);
  return element;
}

async function orbitModelViewer(page: import("@playwright/test").Page): Promise<void> {
  const canvas = page.locator("canvas").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Model viewer canvas is not visible.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
}
