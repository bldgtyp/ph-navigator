import type { CellCoord } from "../../types";

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

export function nextCell(active: CellCoord, rowIndex: number, columnIndex: number): CellCoord {
  return rowIndex === active.rowIndex && columnIndex === active.columnIndex
    ? active
    : { rowIndex, columnIndex };
}
