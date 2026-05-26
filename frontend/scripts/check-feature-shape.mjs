import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEATURES_ROOT = path.join(FRONTEND_ROOT, "src", "features");
const REQUIRED_FILES = ["api.ts", "hooks.ts", "types.ts", "query-keys.ts"];
const SURFACE_DIRS = ["routes", "components"];

function exists(relativePath) {
  return fs.existsSync(relativePath);
}

const violations = [];

for (const entry of fs.readdirSync(FEATURES_ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith(".")) {
    continue;
  }

  const featureRoot = path.join(FEATURES_ROOT, entry.name);
  const missingRequiredFiles = REQUIRED_FILES.filter(
    (fileName) => !exists(path.join(featureRoot, fileName)),
  );
  if (missingRequiredFiles.length > 0) {
    violations.push(`${entry.name}: missing ${missingRequiredFiles.join(", ")}`);
  }

  const missingSurfaceDirs = SURFACE_DIRS.filter(
    (dirName) => !exists(path.join(featureRoot, dirName)),
  );
  if (missingSurfaceDirs.length > 0 && !exists(path.join(featureRoot, "README.md"))) {
    violations.push(`${entry.name}: missing ${missingSurfaceDirs.join(", ")} without README.md`);
  }
}

if (violations.length > 0) {
  console.error("Feature package shape violations:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
