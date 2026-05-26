import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const SEARCH_ROOTS = [path.join(SRC_ROOT, "features"), path.join(SRC_ROOT, "shared", "ui")];
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;

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

function isTestFixturePath(filePath) {
  const segments = filePath.split(path.sep);
  return segments.includes("__tests__") || /\.(test|spec)\.tsx$/.test(filePath);
}

const violations = [];

for (const searchRoot of SEARCH_ROOTS) {
  for (const filePath of walk(searchRoot)) {
    if (!/\.(css|tsx)$/.test(filePath) || path.basename(filePath) === "tokens.css") {
      continue;
    }
    if (filePath.endsWith(".tsx") && isTestFixturePath(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r\n|\n|\r/);
    lines.forEach((line, index) => {
      if (HEX_PATTERN.test(line)) {
        violations.push(`${path.relative(FRONTEND_ROOT, filePath)}:${index + 1}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error("Raw hex color literals are not allowed in feature/shared UI .tsx or .css files:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
