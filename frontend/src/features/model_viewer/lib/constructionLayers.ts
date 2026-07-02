/** Pure adapter: detailed opaque construction → drawable layer geometry.
 *
 * One render path for flat and framed layers (construction-detail D-5): a
 * homogeneous layer is the degenerate single-cell case, so the modal never
 * branches on "honeybee vs honeybee-ph". Reimplements the Envelope
 * canvas-geometry *pattern* against the honeybee wire shape — deliberately
 * no import from features/envelope (D-4, D-8).
 *
 * All numbers stay SI (meters, W/mK, m²K/W); Phase 3 formats them through
 * the shared unit formatters at render time. Colors resolve to CSS here,
 * but a missing `ph_color` stays `null` — the component owns the neutral
 * fallback (D-6).
 */

import type {
  ConstructionMaterial,
  DetailedOpaqueConstruction,
  MaterialDivisions,
  PhColor,
} from "../types";

/** One rectangle of a layer's division grid, placed in fractions of the
 *  layer's extent so the SVG can draw it without re-deriving the grid. */
export type ConstructionCell = {
  label: string;
  color: string | null;
  conductivity: number; // W/mK — the cell material's own λ
  xFraction: number; // 0..1 left edge across the layer
  widthFraction: number; // 0..1 share of the layer's width
  yFraction: number; // 0..1 top edge within the layer (multi-row grids)
  heightFraction: number; // 0..1 share of the layer's thickness
  widthM: number | null; // authored column width (m); null for full-width / degenerate
};

export type ConstructionLayer = {
  index: number; // 0 = exterior-most (honeybee order, Q1 verified)
  label: string;
  thickness: number; // meters
  conductivity: number; // W/mK — homogenized outer value
  rValue: number; // m²K/W = thickness / conductivity
  steelStudSpacingMm: number | null;
  cells: ConstructionCell[]; // ≥1; flat layer = one full-extent cell
};

/** `ph_color` → CSS `rgba()`; null in → null out (component applies the
 *  neutral fallback, D-6). */
export function phColorToCss(color: PhColor | null | undefined): string | null {
  if (!color) return null;
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
}

export function buildConstructionLayers(
  construction: DetailedOpaqueConstruction,
): ConstructionLayer[] {
  return construction.materials.map(layerFromMaterial);
}

/** Σ layer thickness in meters — the one number the header stat, the
 *  drawing scale, and the totals row must all agree on (D-7). */
export function totalThicknessM(layers: ConstructionLayer[]): number {
  return layers.reduce((sum, layer) => sum + layer.thickness, 0);
}

/** A framed layer: more than one segment cell (the degenerate single-cell
 *  case renders as flat, D-5). Shared by the table's expanders and the
 *  modal's default-expanded seed. */
export function isFramedLayer(layer: ConstructionLayer): boolean {
  return layer.cells.length > 1;
}

function layerFromMaterial(material: ConstructionMaterial, index: number): ConstructionLayer {
  const divisions = material.properties?.ph?.divisions;
  const cells = divisions?.cells?.length
    ? gridCells(divisions.cells, divisions.column_widths, divisions.row_heights)
    : [fullExtentCell(material)];
  return {
    index,
    label: materialLabel(material),
    thickness: material.thickness,
    conductivity: material.conductivity,
    rValue: safeRValue(material),
    steelStudSpacingMm: divisions?.steel_stud_spacing_mm ?? null,
    cells,
  };
}

function fullExtentCell(material: ConstructionMaterial): ConstructionCell {
  return {
    label: materialLabel(material),
    color: phColorToCss(material.properties?.ph?.ph_color),
    conductivity: material.conductivity,
    xFraction: 0,
    widthFraction: 1,
    yFraction: 0,
    heightFraction: 1,
    widthM: null,
  };
}

function gridCells(
  cells: MaterialDivisions["cells"],
  columnWidths: number[],
  rowHeights: number[],
): ConstructionCell[] {
  const columnCount = Math.max(columnWidths.length, ...cells.map((cell) => cell.column + 1));
  const rowCount = Math.max(rowHeights.length, ...cells.map((cell) => cell.row + 1));
  const hasAuthoredWidths =
    columnWidths.length === columnCount && columnWidths.reduce((sum, width) => sum + width, 0) > 0;
  const columnFractions = normalizedFractions(columnWidths, columnCount);
  const rowFractions = normalizedFractions(rowHeights, rowCount);
  const columnStarts = cumulativeStarts(columnFractions);
  const rowStarts = cumulativeStarts(rowFractions);

  // Row-major order so the table's sub-rows read left→right, top→bottom.
  return [...cells]
    .sort((a, b) => a.row - b.row || a.column - b.column)
    .map((cell) => ({
      label: materialLabel(cell.material),
      color: phColorToCss(cell.material.properties?.ph?.ph_color),
      conductivity: cell.material.conductivity,
      // Indices are < count by construction; ?? only satisfies
      // noUncheckedIndexedAccess.
      xFraction: columnStarts[cell.column] ?? 0,
      widthFraction: columnFractions[cell.column] ?? 1,
      yFraction: rowStarts[cell.row] ?? 0,
      heightFraction: rowFractions[cell.row] ?? 1,
      widthM: hasAuthoredWidths ? (columnWidths[cell.column] ?? null) : null,
    }));
}

/** Normalize authored sizes (meters) to fractions summing to 1. Degenerate
 *  input — empty, short, or zero-sum — falls back to equal fractions so the
 *  drawing never divides by zero or produces NaN. */
function normalizedFractions(sizes: number[], count: number): number[] {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  if (sizes.length !== count || total <= 0) {
    return Array.from({ length: count }, () => 1 / count);
  }
  return sizes.map((size) => size / total);
}

function cumulativeStarts(fractions: number[]): number[] {
  const starts: number[] = [];
  let position = 0;
  for (const fraction of fractions) {
    starts.push(position);
    position += fraction;
  }
  return starts;
}

function materialLabel(material: ConstructionMaterial): string {
  return material.display_name ?? material.identifier;
}

function safeRValue(material: ConstructionMaterial): number {
  return material.conductivity > 0 ? material.thickness / material.conductivity : 0;
}
