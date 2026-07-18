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
