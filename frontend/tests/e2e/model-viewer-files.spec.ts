import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { createProject, signIn } from "./_helpers";

/**
 * Model Viewer — HBJSON file management round trip + Phase 3 scene-ready smoke.
 *
 * Requires the full dev stack (backend on :8000, MinIO via `make dev`,
 * frontend on strict :5173) and the seeded agent account
 * (`make seed-agent-user`). Uses the canonical 459 KB fixture from the
 * feature planning folder.
 */
const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../planning/features/model-viewer/ph_nav_v2_example.hbjson",
);

test.describe.configure({ mode: "serial" });

test("upload, rename, annotate, deep-link, and delete an HBJSON file", async ({ page }) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  await createProject(page, { name: `Model Viewer ${suffix}`, btNumber: `mv-${suffix}` });

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await expect(page.getByRole("button", { name: /No model uploaded/ })).toBeVisible();

  // Upload through the empty-state drop zone (browse input is hidden).
  await page
    .locator(".model-empty-state input[type=file]")
    .setInputFiles(FIXTURE_PATH);

  // New upload becomes active: chip label, scene-ready hook, and ?file= update.
  await expect(page.getByRole("button", { name: /ph_nav_v2_example/ })).toBeVisible();
  await page.waitForFunction(() => window.__phnModelViewer?.loadPhase === "ready", null, {
    timeout: 30_000,
  });
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.objectCounts.faceMesh ?? 0))
    .toBe(25);
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.objectCounts.apertureMeshFace ?? 0))
    .toBe(30);
  await expect(page).toHaveURL(/[?&]file=[0-9a-f-]+/);

  await selectAnyModelObject(page);
  await expect(page.getByLabel("Selected model element")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null)).toBeNull();

  // Rename via the row menu; saves on Enter.
  await page.getByRole("button", { name: /ph_nav_v2_example/ }).click();
  await page.getByRole("button", { name: "Actions for ph_nav_v2_example" }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await page.getByLabel("File name").fill("Round 2 model");
  await page.getByLabel("File name").press("Enter");
  await expect(page.getByRole("button", { name: /Round 2 model ·/ })).toBeVisible();

  // Add a note; saves on blur.
  await page.getByRole("button", { name: "Actions for Round 2 model" }).click();
  await page.getByRole("menuitem", { name: "Edit notes" }).click();
  await page.getByLabel("File notes").fill("after slab redesign");
  await page.getByLabel("File notes").blur();
  await expect(page.getByText('"after slab redesign"')).toBeVisible();

  // Delete from the row menu; confirm dialog; back to the empty state.
  await page.getByRole("button", { name: "Actions for Round 2 model" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete this HBJSON file?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No model uploaded yet")).toBeVisible();
  await expect(page.getByRole("button", { name: /No model uploaded/ })).toBeVisible();
});

async function selectAnyModelObject(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => {
    const viewer = window.__phnModelViewer;
    const objectId = viewer?.objectIds[0];
    if (!viewer || !objectId) throw new Error("Model viewer object hook is not ready.");
    viewer.selectObject(objectId);
  });
}
