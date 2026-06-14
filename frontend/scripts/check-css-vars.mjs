// Guard: every fallback-less `var(--x)` in a .css file must resolve to a
// custom property that is actually defined somewhere the browser can see
// it. This catches the silent class of bug where a typo'd or stale token
// name (e.g. `var(--danger)` instead of `var(--phn-danger)`) renders to
// the CSS initial value with no error and passes every other guard.
//
// A `var(--x, fallback)` reference is intentionally NOT flagged: the
// fallback makes it a deliberate "optional override" slot (e.g.
// `var(--bg-input, var(--bg-card))`), which is a supported pattern.
//
// "Defined" means one of:
//   1. A CSS custom-property declaration `--x:` in any src .css file
//      (scope-agnostic — all app CSS loads into one global cascade).
//   2. A custom property set from JS via an inline style object, detected
//      as a quoted `"--x"` / '--x' / `--x` literal in any .ts/.tsx file.
//   3. A BLDGTYP brand token. These are defined in the remote brand
//      stylesheet loaded at runtime in index.html, so they never appear
//      as a definition in src/. The allowlist below mirrors
//      https://bldgtyp.github.io/bt-branding/tokens/tokens.css and must
//      be kept in sync (replace with a vendored import if/when the brand
//      tokens are pulled local — see the 2026-06-14 CSS styling review).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

// Mirror of the remote BLDGTYP brand tokens (theme-invariant + light/dark
// share names). Keep in sync with bt-branding/tokens/tokens.css.
const BRAND_TOKENS = new Set([
  "--accent",
  "--accent-light",
  "--accent-dark",
  "--highlight",
  "--highlight-light",
  "--highlight-dark",
  "--highlight-darker",
  "--font-primary",
  "--font-table",
  "--font-mono",
  "--radius-sm",
  "--transition-base",
  "--ease",
  "--bg-page",
  "--bg-card",
  "--bg-elev",
  "--bg-section-alt",
  "--bg-stats",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--border-subtle",
  "--border-card",
  "--border-strong",
  "--accent-text",
  "--highlight-text",
  "--svg-line-heavy",
  "--svg-line-medium",
  "--svg-line-light",
  "--svg-line-faint",
  "--svg-fill-dot",
  "--svg-text",
]);

const CSS_DEFINITION_PATTERN = /(--[\w-]+)\s*:/g;
const JS_PROPERTY_PATTERN = /['"`](--[\w-]+)['"`]/g;
// `var(` + optional space + name + optional space + `)` — i.e. NO comma,
// so no fallback. References with a fallback are skipped on purpose.
const CSS_FALLBACKLESS_VAR_PATTERN = /var\(\s*(--[\w-]+)\s*\)/g;

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(absolutePath);
      continue;
    }
    yield absolutePath;
  }
}

const defined = new Set(BRAND_TOKENS);
const cssFiles = [];

// Pass 1 — collect every definition (CSS declarations + JS-set props).
for (const filePath of walk(SRC_ROOT)) {
  if (/\.css$/.test(filePath)) {
    cssFiles.push(filePath);
    const text = fs.readFileSync(filePath, "utf8");
    for (const match of text.matchAll(CSS_DEFINITION_PATTERN)) {
      defined.add(match[1]);
    }
    continue;
  }
  if (/\.(ts|tsx)$/.test(filePath) && !filePath.endsWith(".d.ts")) {
    const text = fs.readFileSync(filePath, "utf8");
    for (const match of text.matchAll(JS_PROPERTY_PATTERN)) {
      defined.add(match[1]);
    }
  }
}

// Pass 2 — flag fallback-less usages that resolve to nothing.
const violations = [];
for (const filePath of cssFiles) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r\n|\n|\r/);
  lines.forEach((line, index) => {
    for (const match of line.matchAll(CSS_FALLBACKLESS_VAR_PATTERN)) {
      const name = match[1];
      if (!defined.has(name)) {
        violations.push(`${path.relative(FRONTEND_ROOT, filePath)}:${index + 1}  ${name}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error(
    "Undefined CSS custom properties (fallback-less var() that resolves to nothing).",
  );
  console.error(
    "Point each at a real token, or add a fallback `var(--x, <value>)` if it is an optional override:",
  );
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
