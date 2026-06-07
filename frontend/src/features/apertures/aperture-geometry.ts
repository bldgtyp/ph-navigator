// Pure geometry helpers for the Aperture Builder SVG canvas.
//
// All values are in millimetres in the canonical document coordinate system
// (top-left origin, x grows right, y grows down). The substrate renders these
// rectangles directly into an SVG `viewBox`, so there are no React imports
// and no zoom math here — `canvas-constants.pxFromMm` handles the px mapping
// at the component layer.

import type { ApertureElement, ApertureSide, ApertureTypeEntry } from "./types";

export type RectMm = { x: number; y: number; width: number; height: number };

export type ElementRegionsMm = {
  top: RectMm;
  right: RectMm;
  bottom: RectMm;
  left: RectMm;
  glazing: RectMm;
};

export type ElementInsertTarget = {
  edge: ApertureSide;
  axis: "row" | "column";
  atIndex: number;
  rowIndex: number;
  columnIndex: number;
  cellRect: RectMm;
};

export function totalApertureWidthMm(entry: ApertureTypeEntry): number {
  return entry.column_widths_mm.reduce((sum, w) => sum + w, 0);
}

export function totalApertureHeightMm(entry: ApertureTypeEntry): number {
  return entry.row_heights_mm.reduce((sum, h) => sum + h, 0);
}

export function columnXOffsetMm(entry: ApertureTypeEntry, columnIdx: number): number {
  let x = 0;
  for (let i = 0; i < columnIdx; i += 1) {
    x += entry.column_widths_mm[i] ?? 0;
  }
  return x;
}

export function rowYOffsetMm(entry: ApertureTypeEntry, rowIdx: number): number {
  let y = 0;
  for (let i = 0; i < rowIdx; i += 1) {
    y += entry.row_heights_mm[i] ?? 0;
  }
  return y;
}

export function elementRectMm(entry: ApertureTypeEntry, element: ApertureElement): RectMm {
  const [c0, c1] = element.column_span;
  const [r0, r1] = element.row_span;
  const x = columnXOffsetMm(entry, c0);
  const y = rowYOffsetMm(entry, r0);
  let width = 0;
  for (let i = c0; i <= c1; i += 1) width += entry.column_widths_mm[i] ?? 0;
  let height = 0;
  for (let i = r0; i <= r1; i += 1) height += entry.row_heights_mm[i] ?? 0;
  return { x, y, width, height };
}

export function elementInsertTargetAtPointMm(
  entry: ApertureTypeEntry,
  element: ApertureElement,
  point: { x: number; y: number },
): ElementInsertTarget {
  const columnIndex = gridIndexAtPoint(
    entry.column_widths_mm,
    point.x,
    element.column_span[0],
    element.column_span[1],
  );
  const rowIndex = gridIndexAtPoint(
    entry.row_heights_mm,
    point.y,
    element.row_span[0],
    element.row_span[1],
  );
  const cellRect = {
    x: columnXOffsetMm(entry, columnIndex),
    y: rowYOffsetMm(entry, rowIndex),
    width: entry.column_widths_mm[columnIndex] ?? 0,
    height: entry.row_heights_mm[rowIndex] ?? 0,
  };
  const edge = nearestCellEdge(point, cellRect);
  return {
    edge,
    axis: edge === "top" || edge === "bottom" ? "row" : "column",
    atIndex:
      edge === "top"
        ? rowIndex
        : edge === "bottom"
          ? rowIndex + 1
          : edge === "left"
            ? columnIndex
            : columnIndex + 1,
    rowIndex,
    columnIndex,
    cellRect,
  };
}

// Slice an element rect into its four frame strips plus the glazing rect.
// Frame widths come from `element.frames.<side>.width_mm` (0 if the side has
// no frame). The glazing is the element rect minus the four frame strips and
// always renders on top so any shared edge stays clean.
export function elementRegionsMm(element: ApertureElement, rect: RectMm): ElementRegionsMm {
  const tw = element.frames.top?.width_mm ?? 0;
  const rw = element.frames.right?.width_mm ?? 0;
  const bw = element.frames.bottom?.width_mm ?? 0;
  const lw = element.frames.left?.width_mm ?? 0;

  const innerHeight = Math.max(0, rect.height - tw - bw);
  const innerWidth = Math.max(0, rect.width - lw - rw);

  return {
    top: { x: rect.x, y: rect.y, width: rect.width, height: tw },
    bottom: {
      x: rect.x,
      y: rect.y + rect.height - bw,
      width: rect.width,
      height: bw,
    },
    left: {
      x: rect.x,
      y: rect.y + tw,
      width: lw,
      height: innerHeight,
    },
    right: {
      x: rect.x + rect.width - rw,
      y: rect.y + tw,
      width: rw,
      height: innerHeight,
    },
    glazing: {
      x: rect.x + lw,
      y: rect.y + tw,
      width: innerWidth,
      height: innerHeight,
    },
  };
}

export function viewBoxFor(entry: ApertureTypeEntry): RectMm {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, totalApertureWidthMm(entry)),
    height: Math.max(1, totalApertureHeightMm(entry)),
  };
}

// Return a derived element with its column span mirrored for the interior
// view direction. The canonical document is never mutated — `ApertureSvgCanvas`
// reverses `column_widths_mm` and remaps each element through this helper so
// the SVG draws the apparent-from-inside layout. Left/right frame refs swap
// because what was the right jamb seen from outside is now on the left.
export function flipColumnForInterior(
  entry: ApertureTypeEntry,
  element: ApertureElement,
): ApertureElement {
  const cols = entry.column_widths_mm.length;
  const [c0, c1] = element.column_span;
  return {
    ...element,
    column_span: [cols - 1 - c1, cols - 1 - c0],
    frames: {
      ...element.frames,
      left: element.frames.right,
      right: element.frames.left,
    },
  };
}

// Derive an aperture entry that renders as seen from the interior. The
// canonical document is never mutated. Used by both the SVG substrate and
// the DOM overlay so hits stay aligned with the painted rects.
export function mirrorApertureForInterior(entry: ApertureTypeEntry): ApertureTypeEntry {
  return {
    ...entry,
    column_widths_mm: [...entry.column_widths_mm].reverse(),
    elements: entry.elements.map((element) => flipColumnForInterior(entry, element)),
  };
}

function gridIndexAtPoint(
  sizes: number[],
  coordinateMm: number,
  minIndex: number,
  maxIndex: number,
): number {
  let cursor = 0;
  for (let index = 0; index < sizes.length; index += 1) {
    const next = cursor + (sizes[index] ?? 0);
    if (coordinateMm < next || index === sizes.length - 1) {
      return Math.min(maxIndex, Math.max(minIndex, index));
    }
    cursor = next;
  }
  return minIndex;
}

function nearestCellEdge(point: { x: number; y: number }, cell: RectMm): ApertureSide {
  const distances: Array<{ edge: ApertureSide; distance: number }> = [
    { edge: "top", distance: Math.abs(point.y - cell.y) },
    { edge: "right", distance: Math.abs(cell.x + cell.width - point.x) },
    { edge: "bottom", distance: Math.abs(cell.y + cell.height - point.y) },
    { edge: "left", distance: Math.abs(point.x - cell.x) },
  ];
  distances.sort((a, b) => a.distance - b.distance);
  return distances[0]?.edge ?? "top";
}
