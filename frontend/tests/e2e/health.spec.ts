import { test, expect } from "@playwright/test";

test("service status page renders backend health", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PH-Navigator V2" })).toBeVisible();
  await expect(page.getByText("Backend service")).toBeVisible();
  await expect(page.getByText("tb-00", { exact: true })).toBeVisible();
});
