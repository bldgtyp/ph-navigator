import type { NormalizedRange } from "../range/normalize";
import type { FillAxis, FillDirection } from "./axis";

// Extend the source rectangle in `direction` to include the pointer cell.
// The opposite edge stays at the source. Returns the source rectangle
// itself when the pointer sits inside (or past) the source on the
// chosen direction — the caller treats that as "fill canceled."
export function buildFillTargetFromPointer(args: {
  source: NormalizedRange;
  pointerCell: { rowIndex: number; columnIndex: number };
  direction: FillDirection;
  rowCount: number;
  columnCount: number;
}): NormalizedRange {
  const { source, pointerCell, direction, rowCount, columnCount } = args;
  if (direction === "down" || direction === "up") {
    const clampedRow = Math.min(Math.max(pointerCell.rowIndex, 0), Math.max(rowCount - 1, 0));
    if (direction === "down" && clampedRow > source.rowEnd) {
      return {
        rowStart: source.rowStart,
        rowEnd: clampedRow,
        columnStart: source.columnStart,
        columnEnd: source.columnEnd,
      };
    }
    if (direction === "up" && clampedRow < source.rowStart) {
      return {
        rowStart: clampedRow,
        rowEnd: source.rowEnd,
        columnStart: source.columnStart,
        columnEnd: source.columnEnd,
      };
    }
    return source;
  }
  const clampedColumn = Math.min(
    Math.max(pointerCell.columnIndex, 0),
    Math.max(columnCount - 1, 0),
  );
  if (direction === "right" && clampedColumn > source.columnEnd) {
    return {
      rowStart: source.rowStart,
      rowEnd: source.rowEnd,
      columnStart: source.columnStart,
      columnEnd: clampedColumn,
    };
  }
  if (direction === "left" && clampedColumn < source.columnStart) {
    return {
      rowStart: source.rowStart,
      rowEnd: source.rowEnd,
      columnStart: clampedColumn,
      columnEnd: source.columnEnd,
    };
  }
  return source;
}

// Clamp a target rectangle's row span to the contiguous same-group run
// from the source row, in either vertical direction. Horizontal axis is
// a no-op (columns have no group affinity). Ungrouped views (`""`
// sentinel for the source row's pathKey) are also a no-op.
// `buildFillTargetFromPointer`'s contract guarantees a target extends
// on only one side of source per drag frame, so the two clamp branches
// here are independent and never compete.
export function clampRangeToGroup(args: {
  target: NormalizedRange;
  source: NormalizedRange;
  groupPathByRowId: ReadonlyMap<string, string>;
  rowIds: readonly string[];
  axis: FillAxis;
}): { clamped: NormalizedRange; wasClamped: boolean } {
  const { target, source, groupPathByRowId, rowIds, axis } = args;
  if (axis === "horizontal") return { clamped: target, wasClamped: false };
  const sourceRowId = rowIds[source.rowStart];
  const sourceGroup = sourceRowId ? (groupPathByRowId.get(sourceRowId) ?? "") : "";
  if (sourceGroup === "") return { clamped: target, wasClamped: false };
  let rowEnd = target.rowEnd;
  let rowStart = target.rowStart;
  // Downward fill: walk down from the source's bottom edge and stop at
  // the first out-of-group row. Source rows themselves are always in
  // group by construction.
  for (let r = source.rowEnd + 1; r <= rowEnd; r += 1) {
    const id = rowIds[r];
    if (!id || (groupPathByRowId.get(id) ?? "") !== sourceGroup) {
      rowEnd = r - 1;
      break;
    }
  }
  // Upward fill: walk up from the source's top edge and stop at the
  // first out-of-group row.
  for (let r = source.rowStart - 1; r >= rowStart; r -= 1) {
    const id = rowIds[r];
    if (!id || (groupPathByRowId.get(id) ?? "") !== sourceGroup) {
      rowStart = r + 1;
      break;
    }
  }
  const wasClamped = rowEnd !== target.rowEnd || rowStart !== target.rowStart;
  return {
    clamped: { ...target, rowEnd, rowStart },
    wasClamped,
  };
}

// Split a rectangle into contiguous same-group sub-rectangles by row.
// Used by ⌘D when the selection straddles a group boundary: each sub-
// range gets its own source (the top row of the sub-range) and target
// (the rest). Columns are preserved as-is (⌘R doesn't split — the
// horizontal axis is group-free).
export function splitRangeByGroup(args: {
  range: NormalizedRange;
  groupPathByRowId: ReadonlyMap<string, string>;
  rowIds: readonly string[];
}): NormalizedRange[] {
  const { range, groupPathByRowId, rowIds } = args;
  const subRanges: NormalizedRange[] = [];
  let runStart = range.rowStart;
  let runGroup: string | null = null;
  for (let r = range.rowStart; r <= range.rowEnd; r += 1) {
    const id = rowIds[r];
    if (!id) continue;
    const group = groupPathByRowId.get(id) ?? "";
    if (runGroup === null) {
      runGroup = group;
      runStart = r;
      continue;
    }
    if (group !== runGroup) {
      subRanges.push({
        rowStart: runStart,
        rowEnd: r - 1,
        columnStart: range.columnStart,
        columnEnd: range.columnEnd,
      });
      runStart = r;
      runGroup = group;
    }
  }
  if (runGroup !== null) {
    subRanges.push({
      rowStart: runStart,
      rowEnd: range.rowEnd,
      columnStart: range.columnStart,
      columnEnd: range.columnEnd,
    });
  }
  return subRanges;
}
