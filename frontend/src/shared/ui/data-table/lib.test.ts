import { describe, expect, test } from "vitest";
import {
  applyTextFilters,
  isCellInRange,
  moveActiveCell,
  parseTsv,
  planPaste,
  rangeToTsv,
  sortRows,
} from "./lib";
import type { DataTableColumnDef } from "./types";

type Row = { id: string; number: string; name: string };

const rows: Row[] = [
  { id: "rm_2", number: "2", name: "Kitchen" },
  { id: "rm_10", number: "10", name: "Bedroom" },
];
const columns: DataTableColumnDef<Row>[] = [
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
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
      rangeToTsv(rows, columns, {
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
      sortRows(rows, columns, [{ fieldKey: "number", direction: "asc" }]).map((row) => row.id),
    ).toEqual(["rm_2", "rm_10"]);
  });

  test("applies text filters and treats dormant rows as pass-through", () => {
    expect(
      applyTextFilters(rows, columns, [
        { fieldKey: "name", operator: "contains", value: "kit" },
      ]).map((row) => row.id),
    ).toEqual(["rm_2"]);
    expect(
      applyTextFilters(rows, columns, [{ fieldKey: "name", operator: "is", value: "BEDROOM" }]).map(
        (row) => row.id,
      ),
    ).toEqual(["rm_10"]);
    expect(
      applyTextFilters(rows, columns, [{ fieldKey: "name", operator: "contains", value: "" }]).map(
        (row) => row.id,
      ),
    ).toEqual(["rm_2", "rm_10"]);
  });

  test("filters empty cell values", () => {
    const rowsWithEmpty: Row[] = [...rows, { id: "rm_empty", number: "11", name: "" }];

    expect(
      applyTextFilters(rowsWithEmpty, columns, [{ fieldKey: "name", operator: "is_empty" }]).map(
        (row) => row.id,
      ),
    ).toEqual(["rm_empty"]);
  });
});
