// Perimeter-vs-interior classification of aperture-element edges — the
// frontend mirror of backend/features/project_document/apertures/
// edge_classification.py. Keep the two in lockstep: the vitest suite
// copies the backend case tables verbatim (see the pairing note in both
// test files).
//
// An element side is INTERIOR (a mull joint, derived Ψ-install = 0) iff
// every grid cell across that side belongs to another element of kind
// "glazed". Sides on the aperture boundary are perimeter, and cells of
// "void" elements count as perimeter too (a void panel is an opening in
// the sash layout, so its boundary is still an install edge). A side
// abutting a mix of glazed and void cells is perimeter — only a fully
// mulled side carries no install edge.

import { APERTURE_SIDES, type ApertureSide, type ApertureTypeEntry } from "./types";

export type EdgeClass = "perimeter" | "interior";

export function edgeClassKey(elementId: string, side: ApertureSide): string {
  return `${elementId}:${side}`;
}

/** Classify every side of every element (void elements are all-perimeter). */
export function classifyElementEdges(aperture: ApertureTypeEntry): Map<string, EdgeClass> {
  const rows = aperture.row_heights_mm.length;
  const cols = aperture.column_widths_mm.length;

  const glazedCells = new Set<string>();
  for (const element of aperture.elements) {
    if (element.kind !== "glazed") continue;
    for (let row = element.row_span[0]; row <= element.row_span[1]; row += 1) {
      for (let column = element.column_span[0]; column <= element.column_span[1]; column += 1) {
        glazedCells.add(`${row},${column}`);
      }
    }
  }

  const classes = new Map<string, EdgeClass>();
  for (const element of aperture.elements) {
    if (element.kind !== "glazed") {
      for (const side of APERTURE_SIDES) classes.set(edgeClassKey(element.id, side), "perimeter");
      continue;
    }
    const [rowStart, rowEnd] = element.row_span;
    const [columnStart, columnEnd] = element.column_span;
    const columns = rangeInclusive(columnStart, columnEnd);
    const rowRange = rangeInclusive(rowStart, rowEnd);
    const neighbourCells: Record<ApertureSide, string[]> = {
      top: rowStart > 0 ? columns.map((column) => `${rowStart - 1},${column}`) : [],
      bottom: rowEnd + 1 < rows ? columns.map((column) => `${rowEnd + 1},${column}`) : [],
      left: columnStart > 0 ? rowRange.map((row) => `${row},${columnStart - 1}`) : [],
      right: columnEnd + 1 < cols ? rowRange.map((row) => `${row},${columnEnd + 1}`) : [],
    };
    for (const side of APERTURE_SIDES) {
      const cells = neighbourCells[side];
      const isInterior = cells.length > 0 && cells.every((cell) => glazedCells.has(cell));
      classes.set(edgeClassKey(element.id, side), isInterior ? "interior" : "perimeter");
    }
  }
  return classes;
}

function rangeInclusive(start: number, end: number): number[] {
  const out: number[] = [];
  for (let index = start; index <= end; index += 1) out.push(index);
  return out;
}
