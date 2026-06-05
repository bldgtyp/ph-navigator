// Helpers backing the Split toolbar button. The actual cell explode
// happens server-side; the client only needs to know whether the
// selected element is splittable (≥ 2 cells) so the toolbar button
// can gate correctly.

import type { ApertureElement } from "./types";

export function isSplittable(element: ApertureElement): boolean {
  return (
    element.row_span[1] > element.row_span[0] || element.column_span[1] > element.column_span[0]
  );
}

/** Enumerate the (row, column) cells covered by ``element`` — used by
 *  unit tests and by future client previews. */
export function splitCells(element: ApertureElement): { row: number; column: number }[] {
  const cells: { row: number; column: number }[] = [];
  for (let r = element.row_span[0]; r <= element.row_span[1]; r++) {
    for (let c = element.column_span[0]; c <= element.column_span[1]; c++) {
      cells.push({ row: r, column: c });
    }
  }
  return cells;
}
