#!/usr/bin/env node
/**
 * agent-browser.mjs — reliable, MCP-independent browser driver.
 *
 * WHY THIS EXISTS: the `@playwright/mcp` and `chrome-devtools-mcp` servers launch
 * the user's real Google Chrome against ONE shared persistent profile
 * (`~/Library/Caches/ms-playwright-mcp/mcp-chrome-*`). Chrome allows a single
 * instance per profile, so a second session (or a leftover zombie MCP process)
 * fails with "Browser is already in use … use --isolated". This script sidesteps
 * that entire failure class: it drives the repo's OWN bundled Chromium via a
 * fresh, ephemeral context (`chromium.launch()` — no persistent profile, no
 * lock, ever) and never touches the user's Chrome. See
 * `context/USING_A_WEB_BROWSER.md`.
 *
 * Usage (run from `frontend/`, dev servers up via `make agent-browser-ready`):
 *   node scripts/agent-browser.mjs <route> [flags]
 *   node scripts/agent-browser.mjs /projects/<id>/apertures --out /tmp/apertures.png
 *   node scripts/agent-browser.mjs /dashboard --wait "text=Projects"
 *
 * Flags:
 *   --out <path>       screenshot path (default working/agent-browser/shot-<ts>.png)
 *   --base <url>       base URL (default $E2E_BASE_URL or http://localhost:5173)
 *   --email <addr>     sign-in email (default $E2E_EMAIL or ed@example.com)
 *   --password <pw>    sign-in password (default $E2E_PASSWORD or password)
 *   --wait <selector>  wait for a Playwright selector before shooting (repeatable)
 *   --click <selector> click a selector, in order (repeatable)
 *   --settle <ms>      wait after actions before the shot so debounced saves
 *                      flush (default 800; the app debounces persistence ~500ms)
 *   --full             full-page screenshot (default: viewport only)
 *   --headed           show the window (default: headless)
 *   --no-signin        skip sign-in (for public routes)
 *   --timeout <ms>     per-action timeout (default 15000)
 *
 * Exit codes: 0 = ok, 1 = failure (message on stderr). Console errors from the
 * page are always printed to stdout so callers can inspect them.
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const opts = {
    route: "/",
    out: null,
    base: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    email: process.env.E2E_EMAIL ?? "ed@example.com",
    password: process.env.E2E_PASSWORD ?? "password",
    waits: [],
    clicks: [],
    full: false,
    headed: false,
    signin: true,
    timeout: 15000,
    settle: 800,
  };
  const rest = [...argv];
  while (rest.length) {
    const arg = rest.shift();
    if (arg === "--out") opts.out = rest.shift();
    else if (arg === "--base") opts.base = rest.shift();
    else if (arg === "--email") opts.email = rest.shift();
    else if (arg === "--password") opts.password = rest.shift();
    else if (arg === "--wait") opts.waits.push(rest.shift());
    else if (arg === "--click") opts.clicks.push(rest.shift());
    else if (arg === "--timeout") opts.timeout = Number(rest.shift());
    else if (arg === "--settle") opts.settle = Number(rest.shift());
    else if (arg === "--full") opts.full = true;
    else if (arg === "--headed") opts.headed = true;
    else if (arg === "--no-signin") opts.signin = false;
    else if (!arg.startsWith("--")) opts.route = arg;
    else throw new Error(`Unknown flag: ${arg}`);
  }
  opts.base = opts.base.replace(/\/$/, "");
  opts.out ??= `working/agent-browser/shot-${Date.now()}.png`;
  return opts;
}

async function signIn(page, opts) {
  await page.goto(`${opts.base}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel("Password").fill(opts.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: opts.timeout });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outPath = resolve(opts.out);
  mkdirSync(dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: !opts.headed });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.setDefaultTimeout(opts.timeout);
  const page = await context.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  try {
    if (opts.signin) await signIn(page, opts);
    await page.goto(`${opts.base}${opts.route}`, { waitUntil: "networkidle" });
    for (const selector of opts.waits) {
      await page.locator(selector).first().waitFor({ state: "visible" });
    }
    for (const selector of opts.clicks) {
      await page.locator(selector).first().click();
    }
    // Let post-click renders settle, then wait out the app's save debounce
    // (~500ms) so any triggered persistence PUT actually flushes before we
    // screenshot and tear down — otherwise a verification run can close the
    // browser before the save fires and wrongly conclude "did not persist".
    await page.waitForLoadState("networkidle").catch(() => undefined);
    if (opts.settle > 0) await page.waitForTimeout(opts.settle);
    await page.screenshot({ path: outPath, fullPage: opts.full });

    console.log(`OK  url=${page.url()}`);
    console.log(`SHOT ${outPath}`);
    if (consoleErrors.length) {
      console.log(`CONSOLE ERRORS (${consoleErrors.length}):`);
      for (const line of consoleErrors.slice(0, 20)) console.log(`  ${line}`);
    } else {
      console.log("CONSOLE ERRORS: none");
    }
  } catch (error) {
    // Best-effort failure shot so the caller can see the stuck state.
    await page.screenshot({ path: outPath, fullPage: opts.full }).catch(() => undefined);
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    if (consoleErrors.length) {
      console.error(`CONSOLE ERRORS (${consoleErrors.length}):`);
      for (const line of consoleErrors.slice(0, 20)) console.error(`  ${line}`);
    }
    console.error(`(failure screenshot, if captured: ${outPath})`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
