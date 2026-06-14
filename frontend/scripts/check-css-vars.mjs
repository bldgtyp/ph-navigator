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
//   3. A BLDGTYP brand token. These come from the vendored brand
//      stylesheet (src/styles/brand/tokens.css), a pinned copy of
//      https://bldgtyp.github.io/bt-branding/tokens/tokens.css refreshed
//      via `pnpm run sync:brand`. The allowlist below is read straight
//      from that file rather than hand-mirrored, so it stays in sync
//      automatically when the vendored copy is refreshed. See
//      planning/archive/css-brand-dependency-resilience/.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const BRAND_TOKENS_FILE = path.join(SRC_ROOT, "styles", "brand", "tokens.css");

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

// Brand tokens are sourced from the vendored copy, not hand-mirrored, so
// the allowlist tracks `pnpm run sync:brand` automatically. If the file is
// missing the brand tokens won't be allowlisted and every `--accent`-style
// reference fails the guard — a loud signal that vendoring is broken.
function readBrandTokens() {
  if (!fs.existsSync(BRAND_TOKENS_FILE)) {
    console.error(
      `Vendored brand tokens not found at ${path.relative(FRONTEND_ROOT, BRAND_TOKENS_FILE)}.`,
    );
    console.error("Run `pnpm run sync:brand` to vendor them.");
    process.exit(1);
  }
  const text = fs.readFileSync(BRAND_TOKENS_FILE, "utf8");
  return [...text.matchAll(CSS_DEFINITION_PATTERN)].map((match) => match[1]);
}

const defined = new Set(readBrandTokens());
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
