import { test, expect } from "@playwright/test";

test("editor creates a project and public viewer can open the shell", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in\?next=%2F/);
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL ?? "ed@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();

  let btNumber = "";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = String(1000 + Math.floor(Math.random() * 9000));
    const response = await page.request.get(
      `/api/v1/projects/check-bt-number?value=${encodeURIComponent(candidate)}`,
    );
    const body = (await response.json()) as { available: boolean };
    if (body.available) {
      btNumber = candidate;
      break;
    }
  }
  expect(btNumber).not.toBe("");

  await page.getByRole("button", { name: "New project" }).click();
  await page.getByLabel("Project name").fill(`E2E Project ${btNumber}`);
  await page.getByLabel("BT number").fill(btNumber);
  await page.getByLabel("Client").fill("BLDGTYP");
  await page.getByRole("checkbox", { name: "PHI", exact: true }).check();
  await expect(page.getByText("BT number available")).toBeVisible();
  await page.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/status/);
  await expect(page.getByRole("heading", { name: "Status" })).toBeVisible();
  await expect(page.getByText(`${btNumber} · BLDGTYP`)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Track this project's lifecycle milestones." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply BLDGTYP default template" }).click();
  await expect(page.getByText("CAD files received")).toBeVisible();
  await expect(page.getByText("Design Model complete")).toBeVisible();

  await page.getByRole("button", { name: "Set CAD files received to Done" }).click();
  await expect(page.getByText("Done")).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByLabel("Completion date").fill("2026-05-01");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page.getByRole("button", { name: "May 1, 2026" })).toBeVisible();

  await page.getByRole("button", { name: "Move Design Model complete up" }).click();
  await expect(page.locator(".status-title-button").first()).toHaveText("Design Model complete");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).last().click();
  await expect(page.getByText("Certification Complete")).toHaveCount(0);

  const publicUrl = page.url();
  const publicContext = await browser.newContext();
  try {
    const publicPage = await publicContext.newPage();
    await publicPage.goto(publicUrl);
    await expect(publicPage.getByText("Read-only public view")).toBeVisible();
    await expect(publicPage.getByText("Edit controls hidden")).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Status" })).toBeVisible();
    await expect(publicPage.getByText("CAD files received")).toBeVisible();
    await expect(publicPage.getByRole("button", { name: "Add item" })).toHaveCount(0);
    await expect(publicPage.getByRole("button", { name: "Delete" })).toHaveCount(0);
  } finally {
    await publicContext.close();
  }
});
