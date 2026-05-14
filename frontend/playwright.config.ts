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
  // Tests share a single seeded editor (ed@example.com) and TB-01 enforces
  // one active session per user, so cross-file parallelism causes auth
  // collisions. Run one worker locally and in CI.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
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
