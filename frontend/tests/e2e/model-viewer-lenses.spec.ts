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
  const pipeSegmentId = await selectAnyModelObject(page, "pipeSegmentLine");
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null))
    .toBe(`element:${pipeSegmentId.slice(0, pipeSegmentId.lastIndexOf(":"))}`);
  await expect(page.getByLabel("Selected model element")).toContainText("Pipe Element");
  await expect(page.getByLabel("Selected model element")).toContainText("Total Length");
  await expect(page.getByLabel("Selected model element")).toContainText(/segments?/);
  await page.getByRole("button", { name: /^1\s/ }).click();
  await expect(page.getByLabel("Selected model element")).toContainText("Water Temp");

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
