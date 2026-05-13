import type {
  CellCoord,
  CellRange,
  CellWrite,
  DataTableColumnDef,
  FieldDef,
  FieldOption,
  FilterCondition,
  SortRule,
} from "./types";
import { generatedId } from "../../lib/ids";

export type NormalizedRange = {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
};

export function normalizeRange(range: CellRange): NormalizedRange {
  return {
    rowStart: Math.min(range.anchor.rowIndex, range.focus.rowIndex),
    rowEnd: Math.max(range.anchor.rowIndex, range.focus.rowIndex),
    columnStart: Math.min(range.anchor.columnIndex, range.focus.columnIndex),
    columnEnd: Math.max(range.anchor.columnIndex, range.focus.columnIndex),
  };
}

export function isCellInRange(cell: CellCoord, range: CellRange | null): boolean {
  if (!range) return false;
  return isCellInNormalizedRange(cell, normalizeRange(range));
}

export function isCellInNormalizedRange(cell: CellCoord, normalized: NormalizedRange): boolean {
  return (
    cell.rowIndex >= normalized.rowStart &&
    cell.rowIndex <= normalized.rowEnd &&
    cell.columnIndex >= normalized.columnStart &&
    cell.columnIndex <= normalized.columnEnd
  );
}

export function moveActiveCell(
  active: CellCoord,
  key: string,
  rowCount: number,
  columnCount: number,
): CellCoord {
  if (rowCount === 0 || columnCount === 0) return active;
  if (key === "ArrowUp")
    return nextCell(active, Math.max(0, active.rowIndex - 1), active.columnIndex);
  if (key === "ArrowDown")
    return nextCell(active, Math.min(rowCount - 1, active.rowIndex + 1), active.columnIndex);
  if (key === "ArrowLeft")
    return nextCell(active, active.rowIndex, Math.max(0, active.columnIndex - 1));
  if (key === "ArrowRight") {
    return nextCell(active, active.rowIndex, Math.min(columnCount - 1, active.columnIndex + 1));
  }
  if (key === "Home") return nextCell(active, active.rowIndex, 0);
  if (key === "End") return nextCell(active, active.rowIndex, columnCount - 1);
  return active;
}

function nextCell(active: CellCoord, rowIndex: number, columnIndex: number): CellCoord {
  return rowIndex === active.rowIndex && columnIndex === active.columnIndex
    ? active
    : { rowIndex, columnIndex };
}

export function clampCellCoord(cell: CellCoord, rowCount: number, columnCount: number): CellCoord {
  if (rowCount === 0 || columnCount === 0) return { rowIndex: 0, columnIndex: 0 };
  const next = {
    rowIndex: Math.min(Math.max(cell.rowIndex, 0), rowCount - 1),
    columnIndex: Math.min(Math.max(cell.columnIndex, 0), columnCount - 1),
  };
  return next.rowIndex === cell.rowIndex && next.columnIndex === cell.columnIndex ? cell : next;
}

export function clampRange(range: CellRange, rowCount: number, columnCount: number): CellRange {
  return {
    anchor: clampCellCoord(range.anchor, rowCount, columnCount),
    focus: clampCellCoord(range.focus, rowCount, columnCount),
  };
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

export function planPaste({
  clipboard,
  target,
  rowCount,
  columnCount,
}: {
  clipboard: string[][];
  target: CellRange;
  rowCount: number;
  columnCount: number;
}) {
  const normalized = normalizeRange(target);
  const targetRows = normalized.rowEnd - normalized.rowStart + 1;
  const targetColumns = normalized.columnEnd - normalized.columnStart + 1;
  const sourceRows = clipboard.length;
  const sourceColumns = Math.max(0, ...clipboard.map((row) => row.length));
  const fillTarget =
    sourceRows === 1 && sourceColumns === 1 && (targetRows > 1 || targetColumns > 1);
  const plannedRows = fillTarget ? targetRows : sourceRows;
  const plannedColumns = fillTarget ? targetColumns : sourceColumns;

  return {
    writes: Array.from({ length: Math.min(plannedRows, rowCount - normalized.rowStart) }).flatMap(
      (_, rowOffset) =>
        Array.from({ length: Math.min(plannedColumns, columnCount - normalized.columnStart) }).map(
          (_, columnOffset) => ({
            rowIndex: normalized.rowStart + rowOffset,
            columnIndex: normalized.columnStart + columnOffset,
            raw: clipboard[fillTarget ? 0 : rowOffset]?.[fillTarget ? 0 : columnOffset] ?? "",
          }),
        ),
    ),
    rowsOverflow: Math.max(0, normalized.rowStart + plannedRows - rowCount),
    columnsOverflow: Math.max(0, normalized.columnStart + plannedColumns - columnCount),
  };
}

export function applyTextFilters<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  filters: FilterCondition[],
): TRow[] {
  const activeFilters = filters.filter((filter) => filter.fieldKey);
  if (activeFilters.length === 0) return rows;
  const columnsByFieldKey = fieldKeyColumnMap(columns);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  return rows.filter((row) =>
    activeFilters.every((filter) => {
      const column = columnsByFieldKey.get(filter.fieldKey);
      if (!column) return true;
      const value = formatClipboardCellValue(
        column.accessor(row),
        fieldDefForColumn(column, fieldDefsByKey),
      )
        .trim()
        .toLowerCase();
      const expected = (filter.value ?? "").trim().toLowerCase();
      if (filter.operator === "is_empty") return value === "";
      if (!expected) return true;
      if (filter.operator === "is") return value === expected;
      return value.includes(expected);
    }),
  );
}

export function sortRows<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  sortRules: SortRule[],
): TRow[] {
  if (sortRules.length === 0) return rows;
  const columnsByFieldKey = fieldKeyColumnMap(columns);
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const sorted = [...rows];
  sorted.sort((left, right) => {
    for (const rule of sortRules) {
      const column = columnsByFieldKey.get(rule.fieldKey);
      if (!column) continue;
      const fieldDef = fieldDefForColumn(column, fieldDefsByKey);
      const result =
        fieldDef?.field_type === "single_select"
          ? compareSingleSelectValues(column.accessor(left), column.accessor(right), fieldDef)
          : formatClipboardValue(column.accessor(left)).localeCompare(
              formatClipboardValue(column.accessor(right)),
              undefined,
              {
                numeric: true,
                sensitivity: "base",
              },
            );
      if (result !== 0) return rule.direction === "asc" ? result : -result;
    }
    return 0;
  });
  return sorted;
}

export type CoercePasteResult =
  | {
      ok: true;
      writes: CellWrite[];
      newOptions: Record<string, FieldOption[]>;
    }
  | {
      ok: false;
      errors: { rowIndex: number; columnIndex: number; raw: string; message: string }[];
    };

export function coercePasteWrites<TRow>({
  plannedWrites,
  rows,
  columns,
  fieldDefs,
  getRowId,
}: {
  plannedWrites: { rowIndex: number; columnIndex: number; raw: string }[];
  rows: TRow[];
  columns: DataTableColumnDef<TRow>[];
  fieldDefs: FieldDef[];
  getRowId: (row: TRow) => string;
}): CoercePasteResult {
  const errors: { rowIndex: number; columnIndex: number; raw: string; message: string }[] = [];
  const writes: CellWrite[] = [];
  const optionsByField = new Map(
    fieldDefs.map((fieldDef) => [fieldDef.field_key, [...(fieldDef.options ?? [])]]),
  );
  const fieldDefsByKey = fieldKeyFieldDefMap(fieldDefs);
  const newOptions: Record<string, FieldOption[]> = {};

  for (const plannedWrite of plannedWrites) {
    const row = rows[plannedWrite.rowIndex];
    const column = columns[plannedWrite.columnIndex];
    if (!row || !column) continue;
    const fieldDef = fieldDefForColumn(column, fieldDefsByKey);
    if (fieldDef?.read_only) {
      errors.push({ ...plannedWrite, message: "Field is read-only." });
      continue;
    }
    const coerced = coerceFieldValue(plannedWrite.raw, fieldDef, () => {
      const options = optionsByField.get(column.fieldKey) ?? [];
      optionsByField.set(column.fieldKey, options);
      return options;
    });
    if (!coerced.ok) {
      errors.push({ ...plannedWrite, message: coerced.message });
      continue;
    }
    writes.push({ rowId: getRowId(row), fieldKey: column.fieldKey, value: coerced.value });
    if (coerced.created) {
      newOptions[column.fieldKey] = [...(newOptions[column.fieldKey] ?? []), coerced.created];
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, writes, newOptions };
}

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

export function formatDisplayCellValue(value: unknown, fieldDef: FieldDef | undefined): string {
  if (fieldDef?.field_type !== "single_select") return formatClipboardValue(value);
  if (value === null || value === undefined || value === "") return "";
  const option = singleSelectOption(value, fieldDef);
  return option?.label ?? "Missing option";
}

export function singleSelectOption(
  value: unknown,
  fieldDef: FieldDef | undefined,
): FieldOption | undefined {
  if (fieldDef?.field_type !== "single_select" || typeof value !== "string") return undefined;
  return fieldDef.options?.find((candidate) => candidate.id === value);
}

export function coerceFieldValue(
  raw: string,
  fieldDef: FieldDef | undefined,
  optionsForField: () => FieldOption[],
  { emptyNumberValue = null }: { emptyNumberValue?: number | null } = {},
): { ok: true; value: unknown; created?: FieldOption } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (fieldDef?.field_type === "number") {
    if (!trimmed) return { ok: true, value: emptyNumberValue };
    const value = Number(trimmed);
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, message: "Expected a number." };
  }
  if (fieldDef?.field_type === "single_select") {
    if (!trimmed) return { ok: true, value: null };
    const options = optionsForField();
    const existing = findFieldOptionByLabel(options, trimmed);
    if (existing) return { ok: true, value: existing.id };
    const created = createFieldOption(trimmed, options);
    options.push(created);
    return { ok: true, value: created.id, created };
  }
  return { ok: true, value: raw };
}

function compareSingleSelectValues(left: unknown, right: unknown, fieldDef: FieldDef): number {
  const leftRank = optionSortRank(left, fieldDef);
  const rightRank = optionSortRank(right, fieldDef);
  if (leftRank !== rightRank) return leftRank - rightRank;
  return formatClipboardCellValue(left, fieldDef).localeCompare(
    formatClipboardCellValue(right, fieldDef),
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    },
  );
}

function optionSortRank(value: unknown, fieldDef: FieldDef): number {
  if (value === null || value === undefined || value === "") return Number.POSITIVE_INFINITY;
  const option = singleSelectOption(value, fieldDef);
  // Missing option ids sort before explicit blanks so corrupt refs stay visible.
  return option?.order ?? Number.MAX_SAFE_INTEGER;
}

function fieldDefForColumn<TRow>(
  column: DataTableColumnDef<TRow> | undefined,
  fieldDefsByKey: Map<string, FieldDef>,
): FieldDef | undefined {
  if (!column) return undefined;
  return fieldDefsByKey.get(column.fieldKey);
}

function fieldKeyFieldDefMap(fieldDefs: FieldDef[]): Map<string, FieldDef> {
  return new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]));
}

export function findFieldOptionByLabel(
  options: FieldOption[],
  rawLabel: string,
): FieldOption | undefined {
  const label = normalizeOptionLabel(rawLabel);
  return options.find((option) => normalizeOptionLabel(option.label) === label);
}

export function hasDuplicateFieldOptionLabels(options: FieldOption[]): boolean {
  const labels = new Set<string>();
  for (const option of options) {
    const label = normalizeOptionLabel(option.label);
    if (!label) continue;
    if (labels.has(label)) return true;
    labels.add(label);
  }
  return false;
}

export function createFieldOption(rawLabel: string, existingOptions: FieldOption[]): FieldOption {
  return {
    id: generatedId("opt"),
    label: rawLabel.trim(),
    color: nextOptionColor(existingOptions.length),
    order: nextOptionOrder(existingOptions),
  };
}

function normalizeOptionLabel(label: string): string {
  return label.trim().toLocaleLowerCase();
}

function nextOptionColor(index: number): string {
  const colors = ["#3b82f6", "#10b981", "#a16207", "#7c3aed", "#0f766e", "#be123c"];
  return colors[index % colors.length] ?? "#6b7280";
}

function nextOptionOrder(options: FieldOption[]): number {
  return options.length ? Math.max(...options.map((option) => option.order)) + 1 : 0;
}

function fieldKeyColumnMap<TRow>(
  columns: DataTableColumnDef<TRow>[],
): Map<string, DataTableColumnDef<TRow>> {
  return new Map(columns.map((column) => [column.fieldKey, column]));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
