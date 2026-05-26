import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const RAW_Z_INDEX_PATTERN = /z-index\s*:\s*\d/;

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

const violations = [];

for (const filePath of walk(SRC_ROOT)) {
  if (!filePath.endsWith(".css")) {
    continue;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r\n|\n|\r/);
  lines.forEach((line, index) => {
    if (RAW_Z_INDEX_PATTERN.test(line)) {
      violations.push(`${path.relative(FRONTEND_ROOT, filePath)}:${index + 1}`);
    }
  });
}

if (violations.length > 0) {
  console.error("Raw integer z-index values are not allowed; use var(--z-*) tokens:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
