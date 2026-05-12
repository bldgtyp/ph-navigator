import { test, expect } from "@playwright/test";

test("editor signs in and reaches the empty dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in\?next=%2F/);
  await page.getByLabel("Email").fill(process.env.E2E_EMAIL ?? "ed@example.com");
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD ?? "password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByText("No projects yet")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
