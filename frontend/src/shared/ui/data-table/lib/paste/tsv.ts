import type { CellRange, DataTableColumnDef, FieldDef } from "../../types";
import { fieldDefForColumn } from "../internal/fieldDefForColumn";
import { fieldKeyFieldDefMap } from "../internal/fieldKeyFieldDefMap";
import { normalizeRange } from "../range/normalize";

export function formatClipboardValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function formatClipboardCellValue(value: unknown, fieldDef: FieldDef | undefined): string {
  if (fieldDef?.field_type !== "single_select") return formatClipboardValue(value);
  if (value === null || value === undefined || value === "") return "";
  const option = fieldDef.options?.find((candidate) => candidate.id === value);
  return option?.label ?? "";
}

export function rangeToTsv<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  range: CellRange,
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
            `<td>${escapeHtml(formatClipboardCellValue(column.accessor(row), fieldDefForColumn(column, fieldDefsByKey)))}</td>`,
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
