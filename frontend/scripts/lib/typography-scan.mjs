// Typography source guard — scanner core for scripts/check-typography.mjs.
//
// Pure functions only (no fs walking) so the rules are unit-testable. The
// contract lives in planning/archive/dated/2026-07-17/typography-consolidation/
// TYPOGRAPHY-CONTRACT.md and, once landed, frontend/src/styles/README.md:
// component CSS may express typography only through the token vocabulary
// (--font-*, --fs-*, --fw-*, --tracking-*, --lh-*) or deliberate
// inheritance. Everything else is a violation. Existing violations are
// accepted only through the checked-in debt baseline
// (scripts/typography-baseline.json), which may only shrink; unavoidable
// technical boundaries (chart/canvas adapters) go through the exception
// registry (scripts/typography-exceptions.json), never raw literals.

import postcss from "postcss";

/** CSS longhands the guard covers, plus the `font` shorthand. */
export const TYPOGRAPHY_CSS_PROPERTIES = new Set([
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "letter-spacing",
  "line-height",
]);

/** TS/TSX style-object / JSX-prop names that set typography at runtime. */
export const TYPOGRAPHY_SCRIPT_PROPERTIES = [
  "fontSize",
  "fontWeight",
  "fontFamily",
  "letterSpacing",
  "lineHeight",
];

// Approved var() token-name pattern per property. A value passes only when
// it is exactly `inherit` or a fallback-less `var(--…)` whose name matches
// (fallbacks would smuggle a literal past the guard). `font:` shorthand is
// prohibited except `font: inherit` — it hides family/size/weight/line-
// height from focused review.
const APPROVED_TOKEN_PATTERNS = {
  "font-family": /^--font-[\w-]+$/,
  "font-size": /^--(?:fs-[\w-]+|data-table-font-size|data-table-header-font-size)$/,
  "font-weight": /^--fw-[\w-]+$/,
  "letter-spacing": /^--tracking-[\w-]+$/,
  "line-height": /^--lh-[\w-]+$/,
};

const SINGLE_VAR_PATTERN = /^var\(\s*(--[\w-]+)\s*\)$/;

function normalizeValue(value) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function isAllowedCssValue(prop, normalizedValue) {
  if (normalizedValue === "inherit") return true;
  if (prop === "font") return false;
  const varMatch = normalizedValue.match(SINGLE_VAR_PATTERN);
  if (!varMatch) return false;
  return APPROVED_TOKEN_PATTERNS[prop].test(varMatch[1]);
}

function ownerOf(decl) {
  const parent = decl.parent;
  if (parent?.type === "rule") return parent.selector.replace(/\s+/g, " ").trim();
  if (parent?.type === "atrule") return `@${parent.name}`;
  return "(root)";
}

/**
 * Scan one CSS file's text. Returns violations:
 * `{ file, owner, property, value, line }` (line is display-only; it is
 * never part of the fingerprint).
 */
export function scanCssText(cssText, relPath) {
  const violations = [];
  const root = postcss.parse(cssText, { from: relPath });
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    if (!TYPOGRAPHY_CSS_PROPERTIES.has(prop)) return;
    const value = normalizeValue(decl.value);
    if (isAllowedCssValue(prop, value)) return;
    violations.push({
      file: relPath,
      owner: ownerOf(decl),
      property: prop,
      value,
      line: decl.source?.start?.line ?? 0,
    });
  });
  return violations;
}

// `fontSize?: number` (optional type field) deliberately does not match;
// required interface fields and real value assignments do, and live in the
// baseline until their call sites are migrated or excepted.
// Value capture stops at the property boundary (`,`, `}`, or EOL) so two
// props on one line each produce their own violation; a JSX expression
// value (`fontSize={12}`) is captured whole.
const SCRIPT_PROPERTY_PATTERN = new RegExp(
  `\\b(${TYPOGRAPHY_SCRIPT_PROPERTIES.join("|")})\\s*[:=]\\s*(\\{[^}\\n]*\\}|[^,}\\n]*)`,
  "g",
);

/**
 * Scan one TS/TSX file's text for inline-style / library typography entry
 * points. Regex-based by design: the CSS parser requirement covers CSS;
 * script entry points only need stable fingerprints for the ratchet.
 */
export function scanScriptText(text, relPath) {
  const violations = [];
  for (const match of text.matchAll(SCRIPT_PROPERTY_PATTERN)) {
    const [, property, rawTail] = match;
    const value = normalizeValue(rawTail.replace(/[,;]\s*$/, "")).slice(0, 80);
    violations.push({
      file: relPath,
      owner: property,
      property,
      value,
      // Display-only (never part of the fingerprint); matches are rare, so
      // counting newlines per match beats indexing every file up front.
      line: text.slice(0, match.index).split("\n").length,
    });
  }
  return violations;
}

/** Stable identity for a violation: file + owner + property + value. */
export function fingerprintOf(violation) {
  return [violation.file, violation.owner, violation.property, violation.value].join(" :: ");
}

/** Collapse violations into `{ fingerprint: count }`, sorted by key. */
export function countFingerprints(violations) {
  const counts = {};
  for (const violation of violations) {
    const key = fingerprintOf(violation);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Apply the exception registry. Each entry must carry a stable `id` and a
 * `fingerprint`; entries must be unique (by id and fingerprint) and must
 * match at least one current violation, otherwise the registry itself is
 * stale and the guard fails.
 */
export function applyExceptions(violations, exceptions) {
  const problems = [];
  const byFingerprint = new Map();
  const seenIds = new Set();
  for (const entry of exceptions) {
    if (!entry.id || !entry.fingerprint || !entry.reason) {
      problems.push(`exception entry missing id/fingerprint/reason: ${JSON.stringify(entry)}`);
      continue;
    }
    if (seenIds.has(entry.id)) problems.push(`duplicate exception id: ${entry.id}`);
    if (byFingerprint.has(entry.fingerprint)) {
      problems.push(`duplicate exception fingerprint: ${entry.fingerprint}`);
    }
    seenIds.add(entry.id);
    byFingerprint.set(entry.fingerprint, { entry, used: false });
  }
  const remaining = [];
  for (const violation of violations) {
    const hit = byFingerprint.get(fingerprintOf(violation));
    if (hit) {
      hit.used = true;
      continue;
    }
    remaining.push(violation);
  }
  for (const { entry, used } of byFingerprint.values()) {
    if (!used) problems.push(`unused exception entry: ${entry.id} (${entry.fingerprint})`);
  }
  return { remaining, problems };
}

/**
 * Ratchet comparison. `added` = fingerprints (or extra occurrences) not in
 * the baseline → new debt, fail. `stale` = baseline entries no longer found
 * at their recorded count → the baseline must be shrunk (via
 * --update-baseline) so debt can only move downward.
 */
export function diffAgainstBaseline(currentCounts, baselineCounts) {
  const added = [];
  const stale = [];
  for (const [key, count] of Object.entries(currentCounts)) {
    const baseline = baselineCounts[key] ?? 0;
    if (count > baseline) added.push({ fingerprint: key, count, baseline });
  }
  for (const [key, baseline] of Object.entries(baselineCounts)) {
    const count = currentCounts[key] ?? 0;
    if (count < baseline) stale.push({ fingerprint: key, count, baseline });
  }
  return { added, stale };
}
