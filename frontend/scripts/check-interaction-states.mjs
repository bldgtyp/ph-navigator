// Guard: interaction states (hover / focus-visible / selected / armed / active)
// paint their RING and their FILL from the app's state language — the
// --state-* group in src/styles/tokens.css, the --data-table-* state pair, or a
// feature-scoped *-ring / *-tint / *-hover / *-selected token that aliases them.
// Text color, borders, opacity, transforms and everything else are free.
//
// Why only ring + fill: those two channels are what "which thing am I pointing
// at" is made of, and they are what gets re-invented per screen (a one-off
// outline color, a novel color-mix wash). The system already decides both —
// see context/DESIGN_SYSTEM.md § Interaction states.
//
// Pre-existing debt is accepted only through the checked-in baseline
// (interaction-states-baseline.json), a ratchet that may shrink, never grow.
//
// Usage:
//   node scripts/check-interaction-states.mjs                   # blocking (CI)
//   node scripts/check-interaction-states.mjs --update-baseline # maintainer-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  countFingerprints,
  diffAgainstBaseline,
  readJson,
  walk,
} from "./lib/guard-utils.mjs";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const BASELINE_FILE = path.join(FRONTEND_ROOT, "scripts", "interaction-states-baseline.json");
const BRAND_DIR = path.join(SRC_ROOT, "styles", "brand");
// Token-definition files declare the language itself.
const EXEMPT_CSS_FILES = new Set(["src/styles/tokens.css"]);

// A selector block counts as a state rule when it targets an interaction state.
const STATE_SELECTOR =
  /:hover\b|:focus-visible\b|:active\b|\[data-armed|\[data-selected|\[data-active|\[data-picked|\[data-mode=|\[aria-pressed="true"\]|\[aria-selected="true"\]|\.is-active\b|\.is-selected\b/;

// The two channels the state language owns.
const RING_PROPERTY = /^(outline|outline-color|box-shadow)$/;
const FILL_PROPERTY = /^(background|background-color)$/;

// Values that carry no color decision.
const NEUTRAL_VALUE = /^(none|transparent|inherit|initial|unset|currentcolor|0)$/i;

/** Tokens that ARE the state language: the app group, the DataTable pair, and
 *  feature aliases whose name says "this is a state color". */
function isStateToken(name) {
  return (
    name.startsWith("--state-") ||
    /^--data-table-.*(hover|selected|active)/.test(name) ||
    /(^|-)(hover|selected|armed|picked|paint|pick|focus)(-|$)/.test(name) ||
    /-(ring|tint)$/.test(name)
  );
}

/** Every custom property referenced by a declaration value. */
function tokensIn(value) {
  return [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((match) => match[1]);
}

/** Blank out comments (keeping newlines, so reported lines stay right): a
 *  comment ahead of a declaration otherwise lands inside the property name. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function scanCss(rawText, relPath) {
  const text = stripComments(rawText);
  const violations = [];
  // Selector { declarations } — nested at-rules are flattened by taking the
  // text immediately before each block, which is all this guard needs.
  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = blockPattern.exec(text)) !== null) {
    const selector = match[1].trim();
    if (!STATE_SELECTOR.test(selector)) continue;
    const blockStart = match.index + match[1].length;
    for (const declaration of match[2].split(";")) {
      const [rawProperty, ...rest] = declaration.split(":");
      if (rest.length === 0) continue;
      const property = rawProperty.trim().toLowerCase();
      const value = rest.join(":").trim();
      if (value === "" || NEUTRAL_VALUE.test(value)) continue;
      const channel = RING_PROPERTY.test(property)
        ? "ring"
        : FILL_PROPERTY.test(property)
          ? "fill"
          : null;
      if (channel === null) continue;
      // `outline: 2px solid transparent` and friends: only the color matters.
      if (!/var\(|#|rgb|hsl|color-mix|[a-z]{3,}/i.test(value)) continue;
      const tokens = tokensIn(value);
      if (tokens.length > 0 && tokens.some(isStateToken)) continue;
      if (tokens.length === 0 && NEUTRAL_VALUE.test(value.split(/\s+/).pop() ?? "")) continue;
      violations.push({
        file: relPath.split(path.sep).join("/"),
        line: text.slice(0, blockStart).split("\n").length,
        selector: selector.replace(/\s+/g, " ").slice(0, 80),
        channel,
        property,
        value: value.replace(/\s+/g, " ").slice(0, 90),
      });
    }
  }
  return violations;
}

function fingerprintOf(violation) {
  return `${violation.file} :: ${violation.selector} :: ${violation.property}`;
}

function collectViolations() {
  const violations = [];
  for (const absolutePath of walk(SRC_ROOT, (dir) => dir === BRAND_DIR)) {
    if (!/\.css$/.test(absolutePath)) continue;
    const relPath = path.relative(FRONTEND_ROOT, absolutePath);
    if (EXEMPT_CSS_FILES.has(relPath.split(path.sep).join("/"))) continue;
    violations.push(...scanCss(fs.readFileSync(absolutePath, "utf8"), relPath));
  }
  return violations;
}

const violations = collectViolations();
const currentCounts = countFingerprints(violations, fingerprintOf);
const locations = new Map();
for (const violation of violations) {
  const fingerprint = fingerprintOf(violation);
  if (!locations.has(fingerprint)) {
    locations.set(fingerprint, `${violation.file}:${violation.line}  ${violation.value}`);
  }
}

if (process.argv.includes("--update-baseline")) {
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(currentCounts, null, 2)}\n`);
  console.log(
    `interaction-states baseline updated: ${Object.keys(currentCounts).length} fingerprints ` +
      `(${violations.length} declarations)`,
  );
  process.exit(0);
}

const baselineCounts = readJson(BASELINE_FILE, {});
const { added, stale } = diffAgainstBaseline(currentCounts, baselineCounts);

let failed = false;

if (added.length > 0) {
  failed = true;
  console.error("New off-system interaction state (not in scripts/interaction-states-baseline.json):");
  console.error(
    "Hover/selected/armed rings and fills come from the state tokens — see " +
      "context/DESIGN_SYSTEM.md § Interaction states (--state-hover-ring/-tint, " +
      "--state-selected-ring/-tint, --state-row-hover-bg, --state-ghost-hover-bg, …).",
  );
  for (const { fingerprint } of added) {
    console.error(`  ${locations.get(fingerprint) ?? ""}\n    ${fingerprint}`);
  }
}

if (stale.length > 0) {
  failed = true;
  console.error("Stale baseline entries (state debt fixed — shrink the baseline):");
  console.error("Run `node scripts/check-interaction-states.mjs --update-baseline` and commit it.");
  for (const { fingerprint } of stale) console.error(`  ${fingerprint}`);
}

if (failed) process.exit(1);

console.log(
  `check:interaction-states ok — ${Object.keys(currentCounts).length} baselined fingerprints ` +
    `(${violations.length} declarations), 0 new`,
);
