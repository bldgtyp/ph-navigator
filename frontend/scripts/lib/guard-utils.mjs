// Shared filesystem/CLI helpers for the guard scripts. check-typography.mjs
// consumes these today; the older guards (check-hex, check-css-vars, …) carry
// private copies of walk()/isTestFixturePath predating this module — migrate
// them here rather than adding another copy.

import fs from "node:fs";
import path from "node:path";

/** Recursively yield file paths under dir, pruning directories skipDir rejects. */
export function* walk(dir, skipDir = () => false) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDir(absolutePath)) yield* walk(absolutePath, skipDir);
      continue;
    }
    yield absolutePath;
  }
}

/** Test/fixture sources that guards should not lint. */
export function isTestPath(relPath) {
  const segments = relPath.split(path.sep);
  return (
    segments.includes("__tests__") ||
    segments.includes("testing") ||
    /\.(test|spec)\.(ts|tsx)$/.test(relPath)
  );
}

/** Read+parse a JSON file, returning fallback when it is absent. */
export function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Collapse violations into `{ fingerprint: count }`, sorted by key. The
 * ratchet guards (typography, interaction states) differ only in what a
 * violation *is*, so each passes its own `fingerprintOf`; the counting and the
 * baseline comparison below are the same job in both.
 */
export function countFingerprints(violations, fingerprintOf) {
  const counts = {};
  for (const violation of violations) {
    const key = fingerprintOf(violation);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
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
