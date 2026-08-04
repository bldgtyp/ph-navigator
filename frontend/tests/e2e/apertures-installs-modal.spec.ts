// Installs modal (aperture-psi-install phase 05): arm a type, paint an
// edge, persistence across reopen, apply-to-all, and the phase-04
// FrameRow cell reflecting the change.
import { expect, test } from "@playwright/test";
import { createProject, signInForAgent } from "./_helpers";

test("Installs modal paints edges and persists assignments", async ({ page }) => {
  await signInForAgent(page);
  const suffix = Date.now().toString().slice(-8);
  const projectId = await createProject(page, {
    name: `Installs Modal ${suffix}`,
    btNumber: `im-${suffix}`,
  });

  await page.goto(`/projects/${projectId}/apertures/builder`);
  // Two add affordances exist (sidebar icon + empty-state CTA); use the CTA.
  await page.locator(".apertures-empty__add").click();
  await expect(page.locator(".aperture-element-card").first()).toBeVisible();

  // Open the modal from the header action (title disambiguates from the
  // Installs sub-tab link).
  const openModal = () => page.locator("[title='Window install psi-values']").click();
  await openModal();
  const dialog = page.getByRole("dialog", { name: /Installs —/ });
  await expect(dialog).toBeVisible();

  // Fresh project: only the Default row, zero usage. (Scoped to the
  // legend — the edge buttons' aria-labels also mention "Default".)
  const defaultRow = dialog.getByTestId("installs-legend").getByRole("button", { name: /Default/ });
  await expect(defaultRow).toContainText("0 edges");

  // Arm the Default type and paint the top edge.
  await defaultRow.click();
  const topEdge = dialog.locator("[data-testid^='install-edge-'][data-testid$='-top']");
  await expect(topEdge).toHaveAttribute("data-kind", "default");
  await topEdge.click();
  await expect(topEdge).toHaveAttribute("data-kind", "assigned");
  await expect(defaultRow).toContainText("1 edges");

  // Re-clicking the same edge with the same armed type clears to inherit.
  await topEdge.click();
  await expect(topEdge).toHaveAttribute("data-kind", "default");

  // Apply to all edges, then close; the FrameRow Ψ-inst cells go unmuted
  // (assigned) for every perimeter side of the 1x1 element.
  await dialog.getByRole("button", { name: "Apply selected to all edges" }).click();
  await expect(defaultRow).toContainText("4 edges");
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  const psiCell = page.locator("[data-testid='install-psi-top']").first();
  await expect(psiCell).not.toHaveClass(/aperture-card-row__metric--muted/);

  // Assignments persist across a reload (draft debounce settled by the
  // waits above) and the modal reopens with the same state.
  await page.reload();
  await expect(page.locator(".aperture-element-card").first()).toBeVisible();
  await openModal();
  await expect(
    dialog.getByTestId("installs-legend").getByRole("button", { name: /Default/ }),
  ).toContainText("4 edges");
});
