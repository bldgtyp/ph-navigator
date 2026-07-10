import { formatNumberUnitsDisplay, type UnitSystem } from "../../../../../lib/units";
import type { CellRange, DataTableColumnDef, FieldDef } from "../../types";
import { displayUnitsFor } from "../fieldUnits";
import { fieldDefForColumn } from "../internal/fieldDefForColumn";
import { fieldKeyFieldDefMap } from "../internal/fieldKeyFieldDefMap";
import { formatPlainNumberDisplay } from "../numberDisplay";
import { normalizeRange } from "../range/normalize";

export function formatClipboardValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

// `unitSystem` is honored only for number fields with `numberUnits`.
// Defaults to "SI" so untouched callers preserve their pre-units
// behavior (plain Number, text, etc.).
export function formatClipboardCellValue(
  value: unknown,
  fieldDef: FieldDef | undefined,
  unitSystem: UnitSystem = "SI",
): string {
  if (fieldDef?.field_type === "single_select") {
    if (value === null || value === undefined || value === "") return "";
    const option = fieldDef.options?.find((candidate) => candidate.id === value);
    return option?.label ?? "";
  }
  // A unit-bearing field (number or numeric formula) copies its unit-formatted
  // value so the clipboard matches the grid; a formula error overlay (an object)
  // is excluded and falls through to the raw path.
  const displayUnits = displayUnitsFor(fieldDef);
  if (displayUnits && (fieldDef?.field_type === "number" || typeof value === "number")) {
    return formatNumberUnitsDisplay(value, displayUnits, unitSystem);
  }
  if (fieldDef?.field_type === "number") {
    return formatPlainNumberDisplay(value, fieldDef);
  }
  return formatClipboardValue(value);
}

export function rangeToTsv<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  range: CellRange,
  unitSystem: UnitSystem = "SI",
): string {
  const normalized = normalizeRange(range);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const lines: string[] = [];
  for (let rowIndex = normalized.rowStart; rowIndex <= normalized.rowEnd; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;
    const values: string[] = [];
    for (
      let columnIndex = normalized.columnStart;
      columnIndex <= normalized.columnEnd;
      columnIndex += 1
    ) {
      values.push(
        formatClipboardCellValue(
          columns[columnIndex]?.accessor(row),
          fieldDefForColumn(columns[columnIndex], fieldDefsByKey),
          unitSystem,
        ),
      );
    }
    lines.push(values.join("\t"));
  }
  return lines.join("\n");
}

export function rangeToHtml<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  range: CellRange,
  unitSystem: UnitSystem = "SI",
): string {
  const normalized = normalizeRange(range);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const body = rows
    .slice(normalized.rowStart, normalized.rowEnd + 1)
    .map((row) => {
      const cells = columns
        .slice(normalized.columnStart, normalized.columnEnd + 1)
        .map(
          (column) =>
            `<td>${escapeHtml(formatClipboardCellValue(column.accessor(row), fieldDefForColumn(column, fieldDefsByKey), unitSystem))}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table>${body}</table>`;
}

export function parseTsv(raw: string): string[][] {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.split("\t"));
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
