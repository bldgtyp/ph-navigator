import type { CellCoord, CellRange } from "../../types";

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
