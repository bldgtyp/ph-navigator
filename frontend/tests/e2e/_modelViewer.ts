import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

export const MODEL_VIEWER_FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../planning/archive/dated/2026-06-13/model-viewer/ph_nav_v2_example.hbjson",
);

export async function waitForModelViewerReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__phnModelViewer?.loadPhase === "ready", null, {
    timeout: 30_000,
  });
}

export async function modelViewerObjectCount(
  page: Page,
  type: keyof NonNullable<Window["__phnModelViewer"]>["objectCounts"],
): Promise<number> {
  return page.evaluate(
    (objectType) => window.__phnModelViewer?.objectCounts[objectType] ?? 0,
    type,
  );
}

export async function selectAnyModelObject(
  page: Page,
  type?: keyof NonNullable<Window["__phnModelViewer"]>["objectCounts"],
): Promise<string> {
  const selected = await page.evaluate((objectType) => {
    const viewer = window.__phnModelViewer;
    if (!viewer) throw new Error("Model viewer object hook is not ready.");
    if (objectType) return viewer.selectAnyModelObject(objectType);
    const objectId = viewer.objectIds[0];
    if (!objectId) return null;
    viewer.selectObject(objectId);
    return objectId;
  }, type);
  expect(selected).toBeTruthy();
  if (!selected) throw new Error("No selectable model object was found.");
  return selected;
}
