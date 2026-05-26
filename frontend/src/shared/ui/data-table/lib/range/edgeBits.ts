import type { NormalizedRange } from "./normalize";

export type EdgeBits = {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
};

// Phase 3 §4.10: edge bits drive the perimeter-outline rendering. Cells
// in the interior of an N×M range have all four bits false; only cells
// on the relevant edge get the corresponding bit. The body composes a
// single `box-shadow` inline style from these bits so the outline draws
// as one contiguous rectangle without interior gridlines (PoC L3.2).
export function computeEdgeBits(
  rowIndex: number,
  columnIndex: number,
  range: NormalizedRange,
): EdgeBits {
  const inside =
    rowIndex >= range.rowStart &&
    rowIndex <= range.rowEnd &&
    columnIndex >= range.columnStart &&
    columnIndex <= range.columnEnd;
  if (!inside) return { top: false, right: false, bottom: false, left: false };
  return {
    top: rowIndex === range.rowStart,
    right: columnIndex === range.columnEnd,
    bottom: rowIndex === range.rowEnd,
    left: columnIndex === range.columnStart,
  };
}
