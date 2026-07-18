#!/usr/bin/env node
/**
 * font-audit.mjs — collect the unique *rendered* typography variants on a page.
 *
 * Walks every visible element that directly owns text (or is a form control),
 * reads its getComputedStyle, and buckets elements into "typography variants"
 * (family | size | weight | style | transform | letter-spacing). For each
 * variant it records where it shows up (inferred use-case roles, example text,
 * example class names) so a variant can be traced back to its CSS source.
 *
 * Same launch/sign-in/teardown shape as agent-browser.mjs (see
 * context/USING_A_WEB_BROWSER.md) — bundled Chromium, ephemeral context,
 * always closes in `finally`.
 *
 * Usage (from `frontend/`, servers up via `make agent-browser-ready`):
 *   node scripts/font-audit.mjs <route> [flags]
 *   node scripts/font-audit.mjs /dashboard --label dashboard
 *   node scripts/font-audit.mjs /projects/<id>/apertures \
 *     --click "text=Add Aperture" --label apertures-add-modal
 *
 * Flags:
 *   --label <name>     state label; names the output file (default: from route)
 *   --out <path>       JSON output (default working/font-audit/<label>.json)
 *   --click <selector> click in order before collecting (repeatable; opens modals)
 *   --wait <selector>  wait for selector before collecting (repeatable)
 *   --settle <ms>      wait after actions before collecting (default 800)
 *   --base/--email/--password/--no-signin/--timeout  as in agent-browser.mjs
 *
 * Output: JSON file with the full variant list + a markdown summary on stdout.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { formatExtras, formatWeight, isOffScale, top } from "./font-audit-lib.mjs";

function parseArgs(argv) {
  const opts = {
    route: "/",
    label: null,
    out: null,
    base: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    email: process.env.E2E_EMAIL ?? "ed@example.com",
    password: process.env.E2E_PASSWORD ?? "password",
    waits: [],
    hovers: [],
    clicks: [],
    signin: true,
    timeout: 15000,
    settle: 800,
  };
  const rest = [...argv];
  while (rest.length) {
    const arg = rest.shift();
    if (arg === "--label") opts.label = rest.shift();
    else if (arg === "--out") opts.out = rest.shift();
    else if (arg === "--base") opts.base = rest.shift();
    else if (arg === "--email") opts.email = rest.shift();
    else if (arg === "--password") opts.password = rest.shift();
    else if (arg === "--wait") opts.waits.push(rest.shift());
    else if (arg === "--hover") opts.hovers.push(rest.shift());
    else if (arg === "--click") opts.clicks.push(rest.shift());
    else if (arg === "--timeout") opts.timeout = Number(rest.shift());
    else if (arg === "--settle") opts.settle = Number(rest.shift());
    else if (arg === "--no-signin") opts.signin = false;
    else if (!arg.startsWith("--")) opts.route = arg;
    else throw new Error(`Unknown flag: ${arg}`);
  }
  opts.base = opts.base.replace(/\/$/, "");
  opts.label ??= opts.route.replace(/^\/|\/$/g, "").replace(/[^a-zA-Z0-9]+/g, "-") || "root";
  opts.out ??= `working/font-audit/${opts.label}.json`;
  return opts;
}

async function signIn(page, opts) {
  await page.goto(`${opts.base}/sign-in`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(opts.email);
  await page.getByLabel("Password").fill(opts.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: opts.timeout });
}

/** Runs inside the browser. Must be fully self-contained. */
function collectTypography() {
  const FORM_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION"]);
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "PATH", "CANVAS"]);

  // Build the px→token map from the LIVE type-scale tokens (tokens.css) and
  // the page's actual root font-size, so the off-scale signal can't drift
  // from the stylesheet the way a hardcoded copy of the scale would.
  function liveSizeTokens() {
    const rootStyle = getComputedStyle(document.documentElement);
    const names = new Set(["--data-table-font-size"]);
    for (const sheet of document.styleSheets) {
      let rules;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet
      }
      for (const rule of rules ?? []) {
        if (!rule.style) continue;
        for (const prop of rule.style) if (prop.startsWith("--fs-")) names.add(prop);
      }
    }
    const remPx = parseFloat(rootStyle.fontSize);
    // Probe element for tokens that aren't plain rem/px (clamp() display
    // sizes): let the browser compute the actual px at this viewport so
    // they map to their token name like the plain scale steps do.
    const probe = document.createElement("span");
    document.body.appendChild(probe);
    const map = {};
    for (const name of names) {
      const raw = rootStyle.getPropertyValue(name).trim();
      if (!raw) continue;
      let px;
      if (/^-?\d*\.?\d+rem$/.test(raw)) px = parseFloat(raw) * remPx;
      else if (/^-?\d*\.?\d+px$/.test(raw)) px = parseFloat(raw);
      else {
        probe.style.fontSize = `var(${name})`;
        px = parseFloat(getComputedStyle(probe).fontSize);
      }
      if (Number.isNaN(px)) continue;
      map[`${px}px`] = name;
    }
    probe.remove();
    return map;
  }

  function hasDirectText(el) {
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) return true;
    }
    return false;
  }

  function directText(el) {
    let out = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) out += node.textContent;
    }
    return out.replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
      return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function inferRole(el) {
    const tag = el.tagName;
    const heading = el.closest("h1,h2,h3,h4,h5,h6");
    let role;
    if (heading) role = `heading:${heading.tagName.toLowerCase()}`;
    else if (el.closest("button,[role='button']")) role = "button";
    else if (tag === "LABEL" || el.closest("label")) role = "label";
    else if (FORM_TAGS.has(tag)) role = tag === "OPTION" ? "select-option" : "input";
    else if (el.closest("th")) role = "table-header";
    else if (el.closest("td")) role = "table-cell";
    else if (el.closest("a")) role = "link";
    else if (el.closest("nav")) role = "nav";
    else if (el.closest("legend,caption,figcaption")) role = "caption";
    else role = "text";

    const modal = el.closest("dialog,[role='dialog'],[class*='modal' i],[class*='dialog' i]");
    if (modal) role = `modal/${role}`;
    return role;
  }

  function descriptor(el) {
    const cls = Array.from(el.classList).slice(0, 3).join(".");
    return el.tagName.toLowerCase() + (cls ? `.${cls}` : "");
  }

  const variants = new Map();
  let scanned = 0;

  for (const el of document.querySelectorAll("*")) {
    if (SKIP_TAGS.has(el.tagName)) continue;
    const isForm = FORM_TAGS.has(el.tagName);
    if (!isForm && !hasDirectText(el)) continue;
    if (!isVisible(el)) continue;
    scanned += 1;

    const cs = getComputedStyle(el);
    const sizePx = parseFloat(cs.fontSize);
    const lh = cs.lineHeight === "normal" ? null : parseFloat(cs.lineHeight);
    const family = cs.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    // Normalize letter-spacing to em so the same tracking at different sizes
    // buckets together (computed px is tracking × font-size). Values inside
    // half a rounding step of zero are "normal" — an explicit 0 and an
    // unset tracking are the same design decision.
    const trackingEm = cs.letterSpacing === "normal" ? 0 : parseFloat(cs.letterSpacing) / sizePx;
    const tracking = Math.abs(trackingEm) < 0.005 ? "normal" : `${trackingEm.toFixed(2)}em`;
    const key = [family, cs.fontSize, cs.fontWeight, cs.fontStyle, cs.textTransform, tracking].join(
      " | ",
    );

    let v = variants.get(key);
    if (!v) {
      v = {
        key,
        family,
        size: cs.fontSize,
        weight: cs.fontWeight,
        style: cs.fontStyle,
        transform: cs.textTransform,
        letterSpacing: tracking,
        // lineHeights/colors are secondary attributes: kept out of the
        // variant key (they'd explode cardinality) but recorded in the JSON
        // for follow-up line-height/color consistency passes.
        lineHeights: {},
        colors: {},
        count: 0,
        roles: {},
        samples: [],
        selectors: {},
      };
      variants.set(key, v);
    }
    v.count += 1;
    const role = inferRole(el);
    v.roles[role] = (v.roles[role] ?? 0) + 1;
    v.colors[cs.color] = (v.colors[cs.color] ?? 0) + 1;
    const lhKey = lh === null ? "normal" : `${(lh / sizePx).toFixed(2)} (${cs.lineHeight})`;
    v.lineHeights[lhKey] = (v.lineHeights[lhKey] ?? 0) + 1;
    const desc = descriptor(el);
    v.selectors[desc] = (v.selectors[desc] ?? 0) + 1;
    const text = isForm ? el.value || el.placeholder || "" : directText(el);
    if (text && v.samples.length < 3 && !v.samples.includes(text.slice(0, 60))) {
      v.samples.push(text.slice(0, 60));
    }
  }

  const list = Array.from(variants.values()).sort((a, b) => b.count - a.count);
  return {
    url: location.href,
    title: document.title,
    elementsScanned: scanned,
    sizeTokens: liveSizeTokens(),
    variants: list,
  };
}

function markdownSummary(label, data) {
  const lines = [];
  const v = data.variants;
  const uniq = (fn) => new Set(v.map(fn)).size;
  lines.push(`## Font audit: ${label}`);
  lines.push(`URL: ${data.url}`);
  lines.push(
    `Elements scanned: ${data.elementsScanned} — **${v.length} variants** | ` +
      `${uniq((x) => x.family)} families | ${uniq((x) => x.size)} sizes | ` +
      `${uniq((x) => x.weight)} weights`,
  );
  const offScale = v.filter(isOffScale);
  if (offScale.length) lines.push(`⚠ ${offScale.length} variants off the token scale (size or weight)`);
  lines.push("");
  lines.push("| # | family | size (token) | weight | style/transform/spacing | n | roles | example selectors | sample text |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  v.forEach((x, i) => {
    lines.push(
      `| ${i + 1} | ${x.family} | ${x.size} (${x.sizeToken}) | ${formatWeight(x.weight)} | ${formatExtras(x)} | ${x.count} | ` +
        `${top(x.roles)} | ${top(x.selectors, 3)} | ${x.samples[0] ?? ""} |`,
    );
  });
  return lines.join("\n");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const outPath = resolve(opts.out);
  mkdirSync(dirname(outPath), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.setDefaultTimeout(opts.timeout);
  const page = await context.newPage();

  // Broken-page canary: a page that failed to render produces a misleadingly
  // small variant list, so surface its console errors with the results.
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
    for (const selector of opts.hovers) {
      await page.locator(selector).first().hover();
    }
    for (const selector of opts.clicks) {
      await page.locator(selector).first().click();
    }
    await page.waitForLoadState("networkidle").catch(() => undefined);
    if (opts.settle > 0) await page.waitForTimeout(opts.settle);

    const data = await page.evaluate(collectTypography);
    for (const v of data.variants) v.sizeToken = data.sizeTokens[v.size] ?? "OFF-SCALE";
    data.label = opts.label;
    data.route = opts.route;
    data.collectedAt = new Date().toISOString();
    writeFileSync(outPath, JSON.stringify(data, null, 2));

    console.log(markdownSummary(opts.label, data));
    console.log("");
    console.log(`JSON ${outPath}`);
    if (consoleErrors.length) {
      console.log(`CONSOLE ERRORS (${consoleErrors.length}):`);
      for (const line of consoleErrors.slice(0, 10)) console.log(`  ${line}`);
    }
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
