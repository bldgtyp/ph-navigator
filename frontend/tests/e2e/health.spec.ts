import { test, expect } from "@playwright/test";

/**
 * Smoke E2E — verifies the scaffold renders. Real coverage lands during
 * feature work alongside `docs/plans/user-stories.md`.
 */
test("scaffold landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PH-Navigator V2" })).toBeVisible();
});
