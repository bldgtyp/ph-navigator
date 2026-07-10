import { numberUnitForSystem, numberUnitLabel, type UnitSystem } from "../../../../../lib/units";
import type { DataTableColumnDef, FieldDef } from "../../types";
import { displayUnitsFor } from "../fieldUnits";
import { isComputedErrorValue } from "../formula/computedValues";
import { formatClipboardCellValue } from "../paste/tsv";

// Blob type for a downloaded CSV. UTF-8 is declared so the BOM (below)
// plus this charset make Excel render non-ASCII (m², em-dash, accents)
// correctly. Exported so the DataTable download handler builds the Blob
// without re-stating the MIME type.
export const CSV_MIME_TYPE = "text/csv;charset=utf-8";

// UTF-8 byte-order mark, emitted as the first code unit of every file.
// Required so Excel auto-detects UTF-8 — without it Excel reads the file
// in the locale's legacy code page and mangles m², µ, the Rooms em-dash,
// and accented project/material names. See PRD §4.4.
const BOM = "﻿";

// RFC-4180 record terminator. Excel-safe; written after every record,
// including the last (a header-only file is one line + terminator).
const RECORD_SEPARATOR = "\r\n";

// Filesystem-illegal characters (`\ / : * ? " < > |`) plus C0 control
// chars. Replaced with `-` in the download filename. A character class
// kept as a module constant so the lint suppression for the control-char
// range lives in exactly one place.
// eslint-disable-next-line no-control-regex -- control chars are exactly what we strip
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

export type TableToCsvParams<TRow> = {
  // Current-view rows, already filtered + sorted by DataTable. Group
  // headers are not included; only the underlying member rows.
  rows: readonly TRow[];
  // Visible, ordered, hidden-excluded columns with the identifier pinned
  // first — exactly what is on screen (WYSIWYG, PRD §4.1).
  columns: readonly DataTableColumnDef<TRow>[];
  fieldDefByKey: ReadonlyMap<string, FieldDef>;
  unitSystem: UnitSystem;
  // Drives the download filename; supplied by each consumer via the
  // required `DataTable.tableName` prop.
  tableName: string;
};

export type CsvExport = {
  filename: string;
  // Full file text including the leading BOM and trailing terminator.
  // The handler wraps this in a `Blob` of type `CSV_MIME_TYPE`.
  content: string;
};

// Per-cell text for the CSV. Identical to the clipboard ("copy as TSV")
// serializer — single-select → option label, number+units → active-system
// value, missing option / empty → "" — with one addition: a computed
// formula *error* cell serializes as "" rather than its `{ error }`
// object (PRD §4.3 / Open Q1), keeping the data column clean.
export function formatExportCellValue(
  value: unknown,
  fieldDef: FieldDef | undefined,
  unitSystem: UnitSystem,
): string {
  if (isComputedErrorValue(value)) return "";
  return formatClipboardCellValue(value, fieldDef, unitSystem);
}

// RFC-4180 minimal quoting: a field is wrapped in double quotes only when
// it contains a comma, double quote, CR, or LF; embedded quotes are
// doubled. Values without special characters stay bare.
function csvField(text: string): string {
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

// Header cell text: the column's plain-string `header`, plus the
// active-system unit label for number-with-units columns (e.g.
// "Floor Area (m²)" / "Floor Area (ft²)") so the file is self-describing
// about which unit system it was exported in. The per-cell values then
// carry no unit suffix — the unit lives on the header (PRD §4.2).
function headerLabel<TRow>(
  column: DataTableColumnDef<TRow>,
  fieldDef: FieldDef | undefined,
  unitSystem: UnitSystem,
): string {
  // Suffix the unit for any unit-bearing field (number or numeric formula) so
  // the CSV header matches the on-screen column header.
  const displayUnits = displayUnitsFor(fieldDef);
  if (displayUnits) {
    return `${column.header} (${numberUnitLabel(numberUnitForSystem(displayUnits, unitSystem))})`;
  }
  return column.header;
}

// Replace filesystem-illegal characters (`\ / : * ? " < > |` and control
// chars) with `-`, trim surrounding whitespace and dashes, and fall back
// to "table" when nothing usable remains (e.g. an all-illegal name like
// "///"). Spaces are preserved ("Glazing Types.csv"). Keeps the download
// name predictable; the browser de-dupes repeat downloads as
// "name (1).csv".
export function sanitizeFilename(tableName: string): string {
  const cleaned = tableName
    .replace(ILLEGAL_FILENAME_CHARS, "-")
    .trim()
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "table";
}

// Serialize the current view of a table to a CSV file (pure; no DOM).
// One header row, then one record per current-view row, comma-delimited,
// RFC-4180-quoted, `\r\n`-terminated, with a leading UTF-8 BOM.
export function tableToCsv<TRow>({
  rows,
  columns,
  fieldDefByKey,
  unitSystem,
  tableName,
}: TableToCsvParams<TRow>): CsvExport {
  const headerLine = columns
    .map((column) => csvField(headerLabel(column, fieldDefByKey.get(column.fieldKey), unitSystem)))
    .join(",");
  const lines = [headerLine];
  for (const row of rows) {
    lines.push(
      columns
        .map((column) =>
          csvField(
            formatExportCellValue(
              column.accessor(row),
              fieldDefByKey.get(column.fieldKey),
              unitSystem,
            ),
          ),
        )
        .join(","),
    );
  }
  const content = BOM + lines.join(RECORD_SEPARATOR) + RECORD_SEPARATOR;
  return { filename: `${sanitizeFilename(tableName)}.csv`, content };
}
