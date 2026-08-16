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

  // Fresh project: only the Default row. (Scoped to the legend —
  // the edge buttons' aria-labels also mention "Default" — and anchored at the
  // start of the name so the row's own "Edit install type: Default" pencil
  // does not also match.)
  const legend = dialog.getByTestId("installs-legend");
  const defaultRow = legend.getByRole("button", { name: /^Default/ });
  await expect(defaultRow).toBeVisible();
  // Usage is project-wide, so it lives in the row's editor, not the list.
  await expect(defaultRow).not.toContainText("edges");
  // The painting tools live with the key view, not the footer, and the bulk
  // action is disabled (never removed — that moved the drawing) until armed.
  await expect(dialog.getByRole("button", { name: "Apply to all edges" })).toBeDisabled();

  // Arm the Default type and paint the top edge.
  await defaultRow.click();
  const topEdge = dialog.locator("[data-testid^='install-edge-'][data-testid$='-top']");
  await expect(topEdge).toHaveAttribute("data-kind", "default");
  await topEdge.click();
  await expect(topEdge).toHaveAttribute("data-kind", "assigned");

  // Re-clicking the same edge with the same armed type clears to inherit.
  await topEdge.click();
  await expect(topEdge).toHaveAttribute("data-kind", "default");

  // Cancel discards the staged session: nothing was written.
  await topEdge.click();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await openModal();
  await expect(topEdge).toHaveAttribute("data-kind", "default");

  // Apply to all edges, then save; the FrameRow Ψ-inst cells go unmuted
  // (assigned) for every perimeter side of the 1x1 element.
  await legend.getByRole("button", { name: /^Default/ }).click();
  await dialog.getByRole("button", { name: "Apply to all edges" }).click();
  await expect(topEdge).toHaveAttribute("data-kind", "assigned");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const psiCell = page.locator("[data-testid='install-psi-top']").first();
  await expect(psiCell).not.toHaveClass(/aperture-card-row__metric--muted/);

  // Assignments persist across a reload (draft debounce settled by the
  // waits above) and the modal reopens with the same state.
  await page.reload();
  await expect(page.locator(".aperture-element-card").first()).toBeVisible();
  await openModal();
  await expect(topEdge).toHaveAttribute("data-kind", "assigned");

  // Rename + re-value a type in place, without leaving the modal.
  await legend.getByTestId("installs-edit-type-apit_default").click();
  const form = dialog.getByTestId("installs-edit-form");
  await form.getByLabel("Install type name").fill("Mid-wall");
  await form.getByLabel(/Install type psi-value/).fill("0.031");
  await form.getByRole("button", { name: "Save Default" }).click();
  await expect(form).toBeHidden();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await openModal();
  const renamedRow = legend.getByRole("button", { name: /^Mid-wall/ });
  await expect(renamedRow).toContainText("0.031");
  // Project-wide usage shows in the editor: all four perimeter edges carry it.
  await legend.getByTestId("installs-edit-type-apit_default").click();
  await expect(dialog.getByTestId("installs-edit-form")).toContainText(
    "Used on 4 edges in this project",
  );
});
