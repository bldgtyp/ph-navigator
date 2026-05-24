import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  FIELD_TYPE_DEFAULT_WIDTH,
  GLOBAL_MAX_WIDTH,
  GLOBAL_MIN_WIDTH,
  measureColumnFitWidth,
  resolveColumnMax,
  resolveColumnMin,
  resolveColumnWidth,
  sumColumnWidths,
} from "../lib/columnWidths";
import type { DataTableColumnDef, FieldDef, ViewState } from "../types";

type Row = { id: string; name: string; count: number };

const textColumn: DataTableColumnDef<Row> = {
  id: "name",
  fieldKey: "name",
  header: "Name",
  accessor: (r) => r.name,
};
const numberColumn: DataTableColumnDef<Row> = {
  id: "count",
  fieldKey: "count",
  header: "Count",
  accessor: (r) => r.count,
};

const nameField: FieldDef = { field_key: "name", field_type: "text", display_name: "Name" };
const countField: FieldDef = { field_key: "count", field_type: "number", display_name: "Count" };

function view(
  overrides: Partial<Pick<ViewState, "columnWidths">> = {},
): Pick<ViewState, "columnWidths"> {
  return { columnWidths: {}, ...overrides };
}

describe("resolveColumnWidth", () => {
  test("uses the persisted view-state width when present", () => {
    const width = resolveColumnWidth(textColumn, nameField, view({ columnWidths: { name: 275 } }));
    expect(width).toBe(275);
  });

  test("falls through to defaultWidth when no persisted value exists", () => {
    const column = { ...textColumn, defaultWidth: 175 };
    expect(resolveColumnWidth(column, nameField, view())).toBe(175);
  });

  test("falls through to the field-type default when both are absent", () => {
    expect(resolveColumnWidth(textColumn, nameField, view())).toBe(FIELD_TYPE_DEFAULT_WIDTH.text);
    expect(resolveColumnWidth(numberColumn, countField, view())).toBe(
      FIELD_TYPE_DEFAULT_WIDTH.number,
    );
  });

  test("uses the text default when no fieldDef is registered", () => {
    expect(resolveColumnWidth(textColumn, undefined, view())).toBe(FIELD_TYPE_DEFAULT_WIDTH.text);
  });

  test("rounds float values", () => {
    expect(resolveColumnWidth(textColumn, nameField, view({ columnWidths: { name: 199.6 } }))).toBe(
      200,
    );
  });

  test("clamps to the global minimum", () => {
    expect(resolveColumnWidth(textColumn, nameField, view({ columnWidths: { name: 10 } }))).toBe(
      GLOBAL_MIN_WIDTH,
    );
  });

  test("clamps to the global maximum", () => {
    expect(resolveColumnWidth(textColumn, nameField, view({ columnWidths: { name: 9999 } }))).toBe(
      GLOBAL_MAX_WIDTH,
    );
  });

  test("respects per-column minWidth and maxWidth overrides", () => {
    const column = { ...textColumn, minWidth: 150, maxWidth: 220 };
    expect(resolveColumnWidth(column, nameField, view({ columnWidths: { name: 100 } }))).toBe(150);
    expect(resolveColumnWidth(column, nameField, view({ columnWidths: { name: 9000 } }))).toBe(220);
    expect(resolveColumnMin(column)).toBe(150);
    expect(resolveColumnMax(column)).toBe(220);
  });
});

describe("sumColumnWidths", () => {
  test("sums all visible column widths plus the gutter", () => {
    const fieldDefByKey = new Map([
      ["name", nameField],
      ["count", countField],
    ]);
    const total = sumColumnWidths(
      [
        { ...textColumn, defaultWidth: 200 },
        { ...numberColumn, defaultWidth: 120 },
      ],
      fieldDefByKey,
      view(),
      42,
    );
    expect(total).toBe(42 + 200 + 120);
  });
});

describe("measureColumnFitWidth", () => {
  // Stub HTMLCanvasElement.getContext to return a fake 2D context that
  // sizes text proportional to length. jsdom omits canvas, so without
  // this the lib would throw on first measurement.
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    const fakeCtx = {
      font: "",
      measureText: (text: string) => ({ width: text.length * 7 }),
    };
    HTMLCanvasElement.prototype.getContext = function (kind: string) {
      if (kind === "2d") return fakeCtx as unknown as CanvasRenderingContext2D;
      return null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
  });

  test("returns header-label width when no rows are visible", () => {
    const column: DataTableColumnDef<Row> = {
      id: "name",
      fieldKey: "name",
      header: "MyHeader", // 8 chars * 7px = 56 + padding (28) = 84
      accessor: (r) => r.name,
    };
    const width = measureColumnFitWidth({ column, rows: [], font: "14px sans" });
    expect(width).toBe(8 * 7 + 28);
  });

  test("clamps small header to GLOBAL_MIN_WIDTH", () => {
    const column: DataTableColumnDef<Row> = {
      id: "name",
      fieldKey: "name",
      header: "X", // 1 * 7 = 7 + 28 = 35; clamps to 60
      accessor: (r) => r.name,
    };
    const width = measureColumnFitWidth({ column, rows: [], font: "14px sans" });
    expect(width).toBe(GLOBAL_MIN_WIDTH);
  });

  test("uses widest accessor value (longer than header) and pads + clamps", () => {
    const column: DataTableColumnDef<Row> = {
      id: "name",
      fieldKey: "name",
      header: "Name",
      accessor: (r) => r.name,
    };
    const rows: Row[] = [
      { id: "1", name: "Short", count: 1 },
      { id: "2", name: "A_much_longer_name_here", count: 2 }, // 23 chars * 7 = 161 + 28 = 189
    ];
    const width = measureColumnFitWidth({ column, rows, font: "14px sans" });
    expect(width).toBe(23 * 7 + 28);
  });

  test("uses measureText override when provided", () => {
    const column: DataTableColumnDef<Row> = {
      id: "count",
      fieldKey: "count",
      header: "Count",
      accessor: (r) => r.count,
      measureText: () => "OVERRIDE_LONG_TEXT", // 18 chars * 7 = 126 + 28 = 154
    };
    const rows: Row[] = [{ id: "1", name: "Short", count: 1 }];
    const width = measureColumnFitWidth({ column, rows, font: "14px sans" });
    expect(width).toBe(18 * 7 + 28);
  });

  test("clamps to maxWidth", () => {
    const column: DataTableColumnDef<Row> = {
      id: "name",
      fieldKey: "name",
      header: "Name",
      accessor: (r) => r.name,
      maxWidth: 100,
    };
    const rows: Row[] = [{ id: "1", name: "x".repeat(200), count: 0 }];
    const width = measureColumnFitWidth({ column, rows, font: "14px sans" });
    expect(width).toBe(100);
  });
});
