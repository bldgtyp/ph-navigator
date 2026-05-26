import type { CellRange, CellWrite, DataTableColumnDef, FieldDef, FieldOption } from "../../types";
import { fieldDefForColumn } from "../internal/fieldDefForColumn";
import { fieldKeyFieldDefMap } from "../internal/fieldKeyFieldDefMap";
import { normalizeRange } from "../range/normalize";
import { coerceFieldValue } from "../rows/defaults";

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
