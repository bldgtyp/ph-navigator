import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guard: this script pins the DataTable "uniformity iron-laws" — basic
// affordances that every table, everywhere, must present identically and
// in working order, never as a per-table opt-in. It fails the build if any
// of them is removed or quietly made optional. Two are pinned today:
//   1. Row-expand (sections 1–3) — an always-working Expand control.
//   2. Download CSV (section 4) — an always-present overflow menu item.
//
// History: row-expand was once an optional, consumer-wired capability with
// a silent fallback (a non-interactive <span> that looked exactly like the
// real button). 12 of 19 tables forgot to wire it and shipped a button you
// could not click. The fix made the affordance intrinsic and parent-owned:
// the gutter always renders a real <button>, the handler props are
// REQUIRED at every internal seam, and DataTable always supplies a handler
// (the consumer's `onRowOpen`, else the built-in RecordDetailModal). The
// CSV download follows the same pattern (required `onDownloadCsv` + a
// built-in menu item). This guard pins those invariants so they cannot
// quietly regress.

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_TABLE_ROOT = path.join(FRONTEND_ROOT, "src", "shared", "ui", "data-table");

function read(relativePath) {
  return fs.readFileSync(path.join(DATA_TABLE_ROOT, relativePath), "utf8");
}

const violations = [];

// --- 1. The gutter Expand affordance must always be a real <button>. -----
const gutter = read(path.join("components", "GridGutter.tsx"));

if (/<button\b[\s\S]{0,200}?data-table-gutter-expand/.test(gutter) === false) {
  violations.push(
    "GridGutter.tsx: no <button> carries className 'data-table-gutter-expand'. " +
      "The row-expand affordance must always render as a clickable button.",
  );
}
if (/<span\b[\s\S]{0,200}?data-table-gutter-expand/.test(gutter)) {
  violations.push(
    "GridGutter.tsx: a <span> carries className 'data-table-gutter-expand'. " +
      "The expand affordance must never be a non-interactive decoration — " +
      "render it as a <button> with an onExpandRow handler.",
  );
}
if (/data-table-gutter-expand"\s+aria-hidden=/.test(gutter)) {
  violations.push(
    "GridGutter.tsx: an aria-hidden 'data-table-gutter-expand' element exists. " +
      "This is the dead-decoration anti-pattern the contract forbids.",
  );
}

// --- 2. Expand handler props must be REQUIRED at every internal seam. -----
// An optional prop is exactly how a table silently omits the wiring; making
// each seam required turns "forgot to wire expand" into a compile error.
const requiredProps = [
  { file: path.join("components", "GridGutter.tsx"), prop: "onExpandRow" },
  { file: path.join("components", "GridBody.tsx"), prop: "onRowExpand" },
  { file: path.join("components", "RowContextMenu.tsx"), prop: "onOpen" },
];
for (const { file, prop } of requiredProps) {
  const source = read(file);
  if (new RegExp(`\\b${prop}\\?:`).test(source)) {
    violations.push(
      `${file}: '${prop}' is declared optional ('${prop}?:'). It must be required so the ` +
        "row-expand wiring cannot be silently omitted.",
    );
  }
}

// --- 3. The dead-decoration CSS must not come back either. ----------------
const css = read("DataTable.css");
if (/data-table-gutter-expand\[aria-hidden/.test(css)) {
  violations.push(
    "DataTable.css: styling for 'data-table-gutter-expand[aria-hidden]' exists. " +
      "There is no aria-hidden expand affordance anymore; remove this rule.",
  );
}

// --- 4. The "Download CSV" overflow affordance is an iron-law too. --------
// Like row-expand, CSV download is a parent-owned, every-table affordance:
// it must be a built-in item in the overflow menu (never injected per-table
// via the consumer `actions` slot), and its handler prop must be REQUIRED
// at every seam so a table cannot silently ship without it. See
// planning/features/table-csv-download/PRD.md §7.
const overflowMenu = read(path.join("components", "ViewMenuOverflow.tsx"));

if (/data-table-overflow-menu-item[\s\S]{0,300}?Download CSV/.test(overflowMenu) === false) {
  violations.push(
    "ViewMenuOverflow.tsx: no built-in 'data-table-overflow-menu-item' button renders " +
      "'Download CSV'. The CSV download must be a parent-owned overflow item, not a " +
      "per-table opt-in.",
  );
}

// The download handler prop must be required (`onDownloadCsv:`), never
// optional (`onDownloadCsv?:`), at every internal seam.
const downloadHandlerSeams = [
  path.join("components", "ViewMenuOverflow.tsx"),
  path.join("components", "GridToolbar.tsx"),
];
for (const file of downloadHandlerSeams) {
  const source = read(file);
  if (/\bonDownloadCsv\?:/.test(source)) {
    violations.push(
      `${file}: 'onDownloadCsv' is declared optional ('onDownloadCsv?:'). It must be ` +
        "required so the CSV-download wiring cannot be silently omitted.",
    );
  } else if (/\bonDownloadCsv:/.test(source) === false) {
    violations.push(
      `${file}: 'onDownloadCsv' is not declared. The CSV-download handler must be a ` +
        "required prop at this seam.",
    );
  }
}

if (violations.length > 0) {
  console.error("DataTable contract violations:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}
