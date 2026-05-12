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

  const publicUrl = page.url();
  const publicContext = await browser.newContext();
  try {
    const publicPage = await publicContext.newPage();
    await publicPage.goto(publicUrl);
    await expect(publicPage.getByText("Read-only public view")).toBeVisible();
    await expect(publicPage.getByText("Edit controls hidden")).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Status" })).toBeVisible();
  } finally {
    await publicContext.close();
  }
});
