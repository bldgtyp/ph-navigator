import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_LINES = 500;
const SIZE_EXCEPTION_PATTERN = /^\/\/\s*@size-exception:\s+\S+/;
const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

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

function countLines(text) {
  if (text.length === 0) {
    return 0;
  }
  const lines = text.split(/\r\n|\n|\r/);
  return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

const violations = [];

for (const filePath of walk(SRC_ROOT)) {
  if (!/\.(ts|tsx)$/.test(filePath) || filePath.endsWith(".d.ts")) {
    continue;
  }

  const text = fs.readFileSync(filePath, "utf8");
  const lineCount = countLines(text);
  if (lineCount <= MAX_LINES) {
    continue;
  }

  const [firstLine = ""] = text.split(/\r\n|\n|\r/, 1);
  if (!SIZE_EXCEPTION_PATTERN.test(firstLine)) {
    violations.push({
      lineCount,
      relativePath: path.relative(FRONTEND_ROOT, filePath),
    });
  }
}

if (violations.length > 0) {
  console.error(
    `Files over ${MAX_LINES} lines require // @size-exception: <link-to-doc> on line 1:`,
  );
  for (const violation of violations) {
    console.error(`  ${violation.relativePath} (${violation.lineCount} lines)`);
  }
  process.exit(1);
}
