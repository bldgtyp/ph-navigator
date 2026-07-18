// Guard: typography in component CSS and TS/TSX comes only from the token
// vocabulary (--font-*, --fs-*, --fw-*, --tracking-*, --lh-*) or deliberate
// inheritance. Pre-existing debt is accepted solely through the checked-in
// baseline (typography-baseline.json), a migration ratchet that may only
// shrink — never refresh it to bless new debt. Unavoidable technical
// boundaries (chart/canvas adapters) live in typography-exceptions.json.
//
// Usage:
//   node scripts/check-typography.mjs                  # blocking check (CI)
//   node scripts/check-typography.mjs --update-baseline  # maintainer-only
//
// Rules + rationale: frontend/src/styles/README.md and
// planning/archive/dated/2026-07-17/typography-consolidation/TYPOGRAPHY-CONTRACT.md.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTestPath, readJson, walk } from "./lib/guard-utils.mjs";
import {
  applyExceptions,
  countFingerprints,
  diffAgainstBaseline,
  fingerprintOf,
  scanCssText,
  scanScriptText,
} from "./lib/typography-scan.mjs";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const BASELINE_FILE = path.join(FRONTEND_ROOT, "scripts", "typography-baseline.json");
const EXCEPTIONS_FILE = path.join(FRONTEND_ROOT, "scripts", "typography-exceptions.json");

// Token-definition files own the raw values; vendored brand CSS is not ours
// to lint. Everything else in src/ must speak tokens.
const EXEMPT_CSS_FILES = new Set(["src/styles/tokens.css"]);
const BRAND_DIR = path.join(SRC_ROOT, "styles", "brand");

function collectViolations() {
  const violations = [];
  for (const absolutePath of walk(SRC_ROOT, (dir) => dir === BRAND_DIR)) {
    const relPath = path.relative(FRONTEND_ROOT, absolutePath);
    if (/\.css$/.test(relPath)) {
      if (EXEMPT_CSS_FILES.has(relPath.split(path.sep).join("/"))) continue;
      violations.push(...scanCssText(fs.readFileSync(absolutePath, "utf8"), relPath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(relPath) && !relPath.endsWith(".d.ts") && !isTestPath(relPath)) {
      violations.push(...scanScriptText(fs.readFileSync(absolutePath, "utf8"), relPath));
    }
  }
  return violations;
}

const updateBaseline = process.argv.includes("--update-baseline");

const exceptions = readJson(EXCEPTIONS_FILE, []);
const { remaining, problems } = applyExceptions(collectViolations(), exceptions);
const currentCounts = countFingerprints(remaining);

if (problems.length > 0) {
  console.error("Typography exception-registry problems:");
  for (const problem of problems) console.error(`  ${problem}`);
}

if (updateBaseline) {
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(currentCounts, null, 2)}\n`);
  console.log(
    `typography baseline updated: ${Object.keys(currentCounts).length} fingerprints ` +
      `(${remaining.length} declarations) written to ${path.relative(FRONTEND_ROOT, BASELINE_FILE)}`,
  );
  process.exit(problems.length > 0 ? 1 : 0);
}

const baselineCounts = readJson(BASELINE_FILE, {});
const { added, stale } = diffAgainstBaseline(currentCounts, baselineCounts);

let failed = problems.length > 0;

if (added.length > 0) {
  failed = true;
  const locations = new Map();
  for (const violation of remaining) {
    const key = fingerprintOf(violation);
    if (!locations.has(key)) locations.set(key, `${violation.file}:${violation.line}`);
  }
  console.error("New typography debt (not in scripts/typography-baseline.json):");
  console.error(
    "Use var(--fs-*/--fw-*/--tracking-*/--lh-*/--font-*) tokens or `inherit`; see src/styles/README.md.",
  );
  for (const { fingerprint, count, baseline } of added) {
    console.error(`  ${locations.get(fingerprint) ?? ""}  ${fingerprint}  (${baseline} -> ${count})`);
  }
}

if (stale.length > 0) {
  failed = true;
  console.error("Stale baseline entries (violation fixed — shrink the baseline):");
  console.error("Run `node scripts/check-typography.mjs --update-baseline` and commit the diff.");
  for (const { fingerprint, count, baseline } of stale) {
    console.error(`  ${fingerprint}  (${baseline} -> ${count})`);
  }
}

if (failed) process.exit(1);

console.log(
  `check:typography ok — ${Object.keys(currentCounts).length} baselined fingerprints remaining` +
    ` (${remaining.length} declarations), 0 new`,
);
