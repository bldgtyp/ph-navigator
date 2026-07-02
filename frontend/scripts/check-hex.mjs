import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const SEARCH_ROOTS = [path.join(SRC_ROOT, "features"), path.join(SRC_ROOT, "shared", "ui")];
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;
const COLOR_FUNCTION_PATTERN = /\b(?:rgb|rgba|hsl|hsla)\(\s*[^)]*\)/i;

// These modules intentionally carry persisted/rendered data colors rather
// than CSS styling. Keep this list small and explicit; feature/shared chrome
// still consumes CSS custom properties.
const SANCTIONED_COLOR_LITERAL_FILES = new Set([
  "src/features/catalogs/materials/fieldDefs.ts",
  "src/features/equipment/heat-pumps/option-helpers.ts",
  "src/features/model_viewer/lib/colorTokens.ts",
  "src/features/model_viewer/lib/colors.ts",
  // ph_color material swatches from the HBJSON wire → CSS rgba() at render.
  "src/features/model_viewer/lib/constructionLayers.ts",
  "src/features/model_viewer/lib/themes.ts",
  "src/shared/ui/data-table/lib/options/create.ts",
]);

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
  const basename = path.basename(filePath);
  return (
    segments.includes("__tests__") ||
    segments.includes("testing") ||
    /\.(test|spec)\.(ts|tsx)$/.test(filePath) ||
    /Fixtures\.(ts|tsx)$/.test(basename)
  );
}

function isSanctionedColorLiteralFile(filePath) {
  return SANCTIONED_COLOR_LITERAL_FILES.has(path.relative(FRONTEND_ROOT, filePath));
}

const violations = [];

for (const searchRoot of SEARCH_ROOTS) {
  for (const filePath of walk(searchRoot)) {
    if (!/\.(css|ts|tsx)$/.test(filePath) || /\.d\.ts$/.test(filePath)) {
      continue;
    }
    if (path.basename(filePath) === "tokens.css") {
      continue;
    }
    if (
      /\.(ts|tsx)$/.test(filePath) &&
      (isTestFixturePath(filePath) || isSanctionedColorLiteralFile(filePath))
    ) {
      continue;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r\n|\n|\r/);
    lines.forEach((line, index) => {
      if (HEX_PATTERN.test(line) || COLOR_FUNCTION_PATTERN.test(line)) {
        violations.push(`${path.relative(FRONTEND_ROOT, filePath)}:${index + 1}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error(
    "Raw color literals are not allowed in feature/shared UI .css, .ts, or .tsx files:",
  );
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
