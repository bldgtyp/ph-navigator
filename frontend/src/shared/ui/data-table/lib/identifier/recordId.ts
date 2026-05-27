import type { DataTableColumnDef } from "../../types";
import { formatClipboardValue } from "../paste/tsv";

export const RECORD_ID_FIELD_KEY = "record_id";

export type DuplicateIdentifierRows = {
  rowNumbers: number[];
  totalOthers: number;
};

export function recordIdColumnId<TRow>(
  columns: readonly DataTableColumnDef<TRow>[],
): string | null {
  return columns.find((column) => column.fieldKey === RECORD_ID_FIELD_KEY)?.id ?? null;
}

// Build the set of rowIds whose record_id value collides with another
// row in the same table. Empty / whitespace identifiers do not warn.
// The map value carries the 1-indexed row numbers of the *other*
// conflicting rows so the tooltip can list them.
export function computeIdentifierDuplicates<TRow>({
  columns,
  rows,
  getRowId,
}: {
  columns: readonly DataTableColumnDef<TRow>[];
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
}): Map<string, DuplicateIdentifierRows> {
  const recordIdColumn = columns.find((column) => column.fieldKey === RECORD_ID_FIELD_KEY);
  if (!recordIdColumn) return new Map();
  const byValue = new Map<string, { rowId: string; rowNumber: number }[]>();
  rows.forEach((row, index) => {
    const value = formatClipboardValue(recordIdColumn.accessor(row)).trim();
    if (value === "") return;
    let bucket = byValue.get(value);
    if (bucket === undefined) {
      bucket = [];
      byValue.set(value, bucket);
    }
    bucket.push({ rowId: getRowId(row), rowNumber: index + 1 });
  });
  const duplicates = new Map<string, DuplicateIdentifierRows>();
  for (const bucket of byValue.values()) {
    if (bucket.length < 2) continue;
    for (const entry of bucket) {
      const rowNumbers: number[] = [];
      for (const other of bucket) {
        if (rowNumbers.length >= 3) break;
        if (other.rowId === entry.rowId) continue;
        rowNumbers.push(other.rowNumber);
      }
      duplicates.set(entry.rowId, {
        rowNumbers,
        totalOthers: bucket.length - 1,
      });
    }
  }
  return duplicates;
}

// Tooltip body for the duplicate warning chip. Caps the explicit row
// numbers at three and appends a "(and X more)" suffix so the tooltip
// stays readable on hot rows.
export function describeDuplicateRows(duplicate: DuplicateIdentifierRows): string {
  if (duplicate.totalOthers <= 0) return "";
  if (duplicate.totalOthers === 1) return `Also used on row ${duplicate.rowNumbers[0]}.`;
  const explicit = duplicate.rowNumbers.join(", ");
  const remainder = duplicate.totalOthers - duplicate.rowNumbers.length;
  const suffix = remainder > 0 ? ` (and ${remainder} more)` : "";
  return `Also used on rows ${explicit}${suffix}.`;
}
