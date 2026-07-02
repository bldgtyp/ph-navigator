import { expect, test } from "@playwright/test";
import { createProject, signIn } from "./_helpers";
import {
  MODEL_VIEWER_FIXTURE_PATH,
  selectAnyModelObject,
  waitForModelViewerReady,
} from "./_modelViewer";

/** Construction-detail acceptance (PRD §7): opaque faces get a
 *  "View Construction" button that opens the read-only assembly modal;
 *  windows do not; Escape/Close dismiss without touching the 3D selection.
 *  The canonical fixture carries flat (homogeneous) constructions — framed
 *  and steel-stud rendering is covered by the RTL suite
 *  (ConstructionDetailModal.test.tsx) against synthetic honeybee-ph data. */
test("opaque faces open the construction detail modal; windows have no button; selection survives", async ({
  page,
}) => {
  await signIn(page, { email: "codex@example.com", password: "password" });

  const suffix = Date.now().toString().slice(-8);
  await createProject(page, {
    name: `Construction Detail ${suffix}`,
    btNumber: `mcd-${suffix}`,
  });

  await page.getByRole("link", { name: "Model", exact: true }).click();
  await page
    .locator(".model-empty-state input[type=file]")
    .setInputFiles(MODEL_VIEWER_FIXTURE_PATH);
  await waitForModelViewerReady(page);
  await page.getByRole("radio", { name: "Set display units to SI" }).click();

  // Opaque face → button appears and opens the modal.
  const faceId = await selectAnyModelObject(page, "faceMesh");
  const viewButton = page.getByRole("button", { name: "View Construction" });
  await expect(viewButton).toBeVisible();
  await viewButton.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("img", { name: /assembly section/ })).toBeVisible();
  const layerRows = dialog.getByTestId("construction-layer-row");
  await expect(layerRows.first()).toBeVisible();
  await expect(dialog.getByRole("row", { name: /Σ layers/ })).toBeVisible();

  // The layer count matches the drawing's layer group count (flat fixture:
  // every layer is a single full-width cell).
  await expect(dialog.getByTestId("construction-stack-layer")).toHaveCount(await layerRows.count());

  // Escape closes the modal and PRESERVES the 3D selection (crit. 7).
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null))
    .toBe(faceId);
  await expect(viewButton).toBeVisible();

  // Close button works too, selection still intact.
  await viewButton.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => window.__phnModelViewer?.selectionId ?? null))
    .toBe(faceId);

  // IP units flow into the modal (crit. 5).
  await page.getByRole("radio", { name: "Set display units to IP" }).click();
  await viewButton.click();
  await expect(dialog.getByText(/in\b/).first()).toBeVisible();
  await page.keyboard.press("Escape");

  // Window selection → no button (crit. 1, D-1).
  await selectAnyModelObject(page, "apertureMeshFace");
  await expect(viewButton).toHaveCount(0);
});
