import type { CellWrite, DataTableColumnDef, FieldDef } from "../../types";
import type { NormalizedRange } from "../range/normalize";

export type PlanFillResult = {
  writes: CellWrite[];
  inverse: CellWrite[];
  skipped: number;
};

// Build the writes / inverse pair for one (source, target) pair. Cyclic
// repeat: target cells outside the source rectangle take their value
// from source[(r - source.rowStart) mod cycleRows][(c - source.columnStart)
// mod cycleColumns]. The `((x % n) + n) % n` guard makes the formula
// symmetric: negative deltas (target rows above source / target columns
// left of source) tile the cycle the same way positive deltas do —
// e.g., a 3-row source (rowStart=8) with target row 7 picks
// source.rowEnd, row 6 picks rowEnd-1, etc. Read-only target columns
// are silently skipped and counted. Cells inside the source rectangle
// are never rewritten.
//
// The caller is responsible for clamping `target` to a group before
// calling — this helper assumes the rectangle is already legal.
export function planFill<TRow>(args: {
  source: NormalizedRange;
  target: NormalizedRange;
  rows: readonly TRow[];
  columns: readonly DataTableColumnDef<TRow>[];
  fieldDefs: readonly FieldDef[];
  getRowId: (row: TRow) => string;
}): PlanFillResult {
  const { source, target, rows, columns, fieldDefs, getRowId } = args;
  const fieldDefsByKey = new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]));
  const writes: CellWrite[] = [];
  const inverse: CellWrite[] = [];
  let skipped = 0;
  const cycleRows = Math.max(1, source.rowEnd - source.rowStart + 1);
  const cycleColumns = Math.max(1, source.columnEnd - source.columnStart + 1);
  for (let r = target.rowStart; r <= target.rowEnd; r += 1) {
    for (let c = target.columnStart; c <= target.columnEnd; c += 1) {
      if (
        r >= source.rowStart &&
        r <= source.rowEnd &&
        c >= source.columnStart &&
        c <= source.columnEnd
      ) {
        continue;
      }
      const targetRow = rows[r];
      const targetCol = columns[c];
      if (!targetRow || !targetCol) continue;
      const fieldDef = fieldDefsByKey.get(targetCol.fieldKey);
      if (fieldDef?.read_only) {
        skipped += 1;
        continue;
      }
      const sr = source.rowStart + ((((r - source.rowStart) % cycleRows) + cycleRows) % cycleRows);
      const sc =
        source.columnStart +
        ((((c - source.columnStart) % cycleColumns) + cycleColumns) % cycleColumns);
      const sourceRow = rows[sr];
      const sourceCol = columns[sc];
      if (!sourceRow || !sourceCol) continue;
      const nextValue = sourceCol.accessor(sourceRow);
      const previousValue = targetCol.accessor(targetRow);
      writes.push({
        rowId: getRowId(targetRow),
        fieldKey: targetCol.fieldKey,
        value: nextValue,
      });
      inverse.push({
        rowId: getRowId(targetRow),
        fieldKey: targetCol.fieldKey,
        value: previousValue,
      });
    }
  }
  return { writes, inverse, skipped };
}
