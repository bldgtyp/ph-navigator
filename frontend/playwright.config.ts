import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for V2 end-to-end tests.
 *
 * - Tests live in tests/e2e/.
 * - The Vite dev server must be running (`make frontend`) before invoking
 *   `make e2e` (we don't auto-start to keep the runner predictable while
 *   the backend is also evolving).
 * - Interactive verification during feature work uses the Playwright MCP
 *   (mcp__plugin_playwright_playwright__*), not this CLI.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
