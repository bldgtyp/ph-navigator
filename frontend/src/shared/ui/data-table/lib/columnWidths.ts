import type { DataTableColumnDef, FieldDef, FieldType, ViewState } from "../types";

// Seed widths per field type. Consulted when both `view.columnWidths[id]`
// and `DataTableColumnDef.defaultWidth` are absent.
export const FIELD_TYPE_DEFAULT_WIDTH: Record<FieldType, number> = {
  text: 200,
  number: 120,
  single_select: 160,
  computed: 140,
  attachment: 120,
  color: 100,
};

// Match AirTable. Per-column overrides take precedence.
export const GLOBAL_MIN_WIDTH = 60;
export const GLOBAL_MAX_WIDTH = 800;

export function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function resolveColumnMin<TRow>(columnDef: DataTableColumnDef<TRow>): number {
  return columnDef.minWidth ?? GLOBAL_MIN_WIDTH;
}

export function resolveColumnMax<TRow>(columnDef: DataTableColumnDef<TRow>): number {
  return columnDef.maxWidth ?? GLOBAL_MAX_WIDTH;
}

// See `context/technical-requirements/data-table.md` § Column widths
// for the precedence chain and persistence rules.
export function resolveColumnWidth<TRow>(
  columnDef: DataTableColumnDef<TRow>,
  fieldDef: FieldDef | undefined,
  view: Pick<ViewState, "columnWidths">,
): number {
  const persisted = view.columnWidths[columnDef.id];
  const typeDefault = fieldDef ? FIELD_TYPE_DEFAULT_WIDTH[fieldDef.field_type] : undefined;
  const seed = persisted ?? columnDef.defaultWidth ?? typeDefault ?? FIELD_TYPE_DEFAULT_WIDTH.text;
  return clamp(Math.round(seed), resolveColumnMin(columnDef), resolveColumnMax(columnDef));
}

export function sumColumnWidths<TRow>(
  visibleColumns: readonly DataTableColumnDef<TRow>[],
  fieldDefByKey: Map<string, FieldDef>,
  view: Pick<ViewState, "columnWidths">,
  gutterPx: number,
): number {
  let total = gutterPx;
  for (const column of visibleColumns) {
    total += resolveColumnWidth(column, fieldDefByKey.get(column.fieldKey), view);
  }
  return total;
}

// Padding mirrors `.data-table td` (10 px each side) plus 8 px slack so
// text never reads "just barely clipped" after a fit-to-content gesture.
const FIT_HORIZONTAL_PADDING = 10 + 10 + 8;

export type MeasureColumnFitWidthArgs<TRow> = {
  column: DataTableColumnDef<TRow>;
  rows: readonly TRow[];
  font: string;
};

export function measureColumnFitWidth<TRow>(args: MeasureColumnFitWidthArgs<TRow>): number {
  const { column, rows, font } = args;
  const ctx = createMeasureContext();
  ctx.font = font;

  let widest = ctx.measureText(column.header).width;
  for (const row of rows) {
    const text = column.measureText ? column.measureText(row) : String(column.accessor(row) ?? "");
    if (!text) continue;
    const w = ctx.measureText(text).width;
    if (w > widest) widest = w;
  }
  const padded = Math.ceil(widest + FIT_HORIZONTAL_PADDING);
  return clamp(padded, resolveColumnMin(column), resolveColumnMax(column));
}

function createMeasureContext(): CanvasRenderingContext2D {
  if (typeof document === "undefined") {
    throw new Error("measureColumnFitWidth requires a DOM (document is undefined).");
  }
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) {
    throw new Error("measureColumnFitWidth could not obtain a 2D canvas context.");
  }
  return ctx;
}
