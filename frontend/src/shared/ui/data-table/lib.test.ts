import { describe, expect, test } from "vitest";
import {
  applyTextFilters,
  coercePasteWrites,
  formatClipboardCellValue,
  formatDisplayCellValue,
  isCellInRange,
  moveActiveCell,
  parseTsv,
  planPaste,
  rangeToTsv,
  sortRows,
} from "./lib";
import type { DataTableColumnDef, FieldDef } from "./types";

type Row = { id: string; number: string; name: string };

const rows: Row[] = [
  { id: "rm_2", number: "2", name: "Kitchen" },
  { id: "rm_10", number: "10", name: "Bedroom" },
];
const columns: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
];
const fieldDefs: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number" },
  { field_key: "name", field_type: "text", display_name: "Name" },
];

describe("DataTable helpers", () => {
  test("normalizes rectangular selection independently of drag direction", () => {
    const range = {
      anchor: { rowIndex: 1, columnIndex: 1 },
      focus: { rowIndex: 0, columnIndex: 0 },
    };

    expect(isCellInRange({ rowIndex: 0, columnIndex: 1 }, range)).toBe(true);
    expect(isCellInRange({ rowIndex: 2, columnIndex: 1 }, range)).toBe(false);
  });

  test("moves the active cell within table bounds", () => {
    const active = { rowIndex: 0, columnIndex: 0 };
    expect(moveActiveCell(active, "ArrowUp", 2, 2)).toBe(active);
    expect(moveActiveCell({ rowIndex: 0, columnIndex: 0 }, "ArrowUp", 2, 2)).toEqual({
      rowIndex: 0,
      columnIndex: 0,
    });
    expect(moveActiveCell({ rowIndex: 0, columnIndex: 0 }, "ArrowRight", 2, 2)).toEqual({
      rowIndex: 0,
      columnIndex: 1,
    });
  });

  test("copies a selected range as TSV", () => {
    expect(
      rangeToTsv(rows, columns, fieldDefs, {
        anchor: { rowIndex: 0, columnIndex: 0 },
        focus: { rowIndex: 1, columnIndex: 1 },
      }),
    ).toBe("2\tKitchen\n10\tBedroom");
  });

  test("plans single-cell paste across a selected rectangle", () => {
    const plan = planPaste({
      clipboard: parseTsv("Ground"),
      target: { anchor: { rowIndex: 0, columnIndex: 0 }, focus: { rowIndex: 1, columnIndex: 1 } },
      rowCount: 2,
      columnCount: 2,
    });

    expect(plan.writes).toHaveLength(4);
    expect(plan.writes.every((write) => write.raw === "Ground")).toBe(true);
    expect(plan.rowsOverflow).toBe(0);
    expect(plan.columnsOverflow).toBe(0);
  });

  test("reports paste overflow without dropping in-bounds writes", () => {
    const plan = planPaste({
      clipboard: parseTsv("A\tB\tC\nD\tE\tF\nG\tH\tI"),
      target: { anchor: { rowIndex: 1, columnIndex: 1 }, focus: { rowIndex: 1, columnIndex: 1 } },
      rowCount: 2,
      columnCount: 2,
    });

    expect(plan.writes).toEqual([{ rowIndex: 1, columnIndex: 1, raw: "A" }]);
    expect(plan.rowsOverflow).toBe(2);
    expect(plan.columnsOverflow).toBe(2);
  });

  test("sorts strings with numeric room-number behavior", () => {
    expect(
      sortRows(rows, columns, fieldDefs, [{ fieldKey: "number", direction: "asc" }]).map(
        (row) => row.id,
      ),
    ).toEqual(["rm_2", "rm_10"]);
  });

  test("applies text filters and treats dormant rows as pass-through", () => {
    expect(
      applyTextFilters(rows, columns, fieldDefs, [
        { fieldKey: "name", operator: "contains", value: "kit" },
      ]).map((row) => row.id),
    ).toEqual(["rm_2"]);
    expect(
      applyTextFilters(rows, columns, fieldDefs, [
        { fieldKey: "name", operator: "is", value: "BEDROOM" },
      ]).map((row) => row.id),
    ).toEqual(["rm_10"]);
    expect(
      applyTextFilters(rows, columns, fieldDefs, [
        { fieldKey: "name", operator: "contains", value: "" },
      ]).map((row) => row.id),
    ).toEqual(["rm_2", "rm_10"]);
  });

  test("filters empty cell values", () => {
    const rowsWithEmpty: Row[] = [...rows, { id: "rm_empty", number: "11", name: "" }];

    expect(
      applyTextFilters(rowsWithEmpty, columns, fieldDefs, [
        { fieldKey: "name", operator: "is_empty" },
      ]).map((row) => row.id),
    ).toEqual(["rm_empty"]);
  });

  test("sorts single-select values by option order and places null last", () => {
    type SelectRow = { id: string; floor: string | null };
    const selectRows: SelectRow[] = [
      { id: "rm_ground", floor: "opt_ground" },
      { id: "rm_empty", floor: null },
      { id: "rm_basement", floor: "opt_basement" },
    ];
    const selectColumns: DataTableColumnDef<SelectRow>[] = [
      { id: "floor", fieldKey: "rooms.floor_level", header: "Floor", accessor: (row) => row.floor },
    ];
    const selectFields: FieldDef[] = [
      {
        field_key: "rooms.floor_level",
        field_type: "single_select",
        display_name: "Floor",
        options: [
          { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 1 },
          { id: "opt_basement", label: "Basement", color: "#6b7280", order: 0 },
        ],
      },
    ];

    expect(
      sortRows(selectRows, selectColumns, selectFields, [
        { fieldKey: "rooms.floor_level", direction: "asc" },
      ]).map((row) => row.id),
    ).toEqual(["rm_basement", "rm_ground", "rm_empty"]);
  });

  test("paste coercion matches or creates single-select options", () => {
    const selectColumns: DataTableColumnDef<Row>[] = [
      { id: "floor", fieldKey: "rooms.floor_level", header: "Floor", accessor: () => null },
    ];
    const selectFields: FieldDef[] = [
      {
        field_key: "rooms.floor_level",
        field_type: "single_select",
        display_name: "Floor",
        options: [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
      },
    ];

    const result = coercePasteWrites({
      plannedWrites: [
        { rowIndex: 0, columnIndex: 0, raw: "ground" },
        { rowIndex: 1, columnIndex: 0, raw: "Level 2" },
      ],
      rows,
      columns: selectColumns,
      fieldDefs: selectFields,
      getRowId: (row) => row.id,
    });

    expect(result).toMatchObject({
      ok: true,
      writes: [
        { rowId: "rm_2", fieldKey: "rooms.floor_level", value: "opt_ground" },
        { rowId: "rm_10", fieldKey: "rooms.floor_level", value: expect.stringMatching(/^opt_/) },
      ],
    });
    expect(result.ok && result.newOptions["rooms.floor_level"]?.[0]?.label).toBe("Level 2");
  });

  test("paste coercion blocks read-only fields", () => {
    const result = coercePasteWrites({
      plannedWrites: [{ rowIndex: 0, columnIndex: 0, raw: "102" }],
      rows,
      columns,
      fieldDefs: [{ ...fieldDefs[0]!, read_only: true }, fieldDefs[1]!],
      getRowId: (row) => row.id,
    });

    expect(result).toEqual({
      ok: false,
      errors: [{ rowIndex: 0, columnIndex: 0, raw: "102", message: "Field is read-only." }],
    });
  });

  test("keeps missing option display text out of clipboard values", () => {
    const fieldDef: FieldDef = {
      field_key: "rooms.floor_level",
      field_type: "single_select",
      display_name: "Floor",
      options: [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
    };

    expect(formatDisplayCellValue("opt_missing", fieldDef)).toBe("Missing option");
    expect(formatClipboardCellValue("opt_missing", fieldDef)).toBe("");
  });
});
