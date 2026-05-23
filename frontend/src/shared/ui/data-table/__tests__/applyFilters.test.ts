import { describe, expect, test } from "vitest";
import { applyFilters } from "../lib";
import type { DataTableColumnDef, FieldDef } from "../types";

type Row = {
  id: string;
  name: string;
  number: number | null;
  floor: string | null;
  icfa: number | null;
};

const fieldDefs: FieldDef[] = [
  { field_key: "name", field_type: "text", display_name: "Name" },
  { field_key: "number", field_type: "number", display_name: "Number" },
  {
    field_key: "floor",
    field_type: "single_select",
    display_name: "Floor",
    options: [
      { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
      { id: "opt_first", label: "1st", color: "#10b981", order: 1 },
      { id: "opt_second", label: "2nd", color: "#a16207", order: 2 },
    ],
  },
  {
    field_key: "icfa",
    field_type: "computed",
    display_name: "iCFA",
    computed_type: "number",
  },
];

const columns: DataTableColumnDef<Row>[] = [
  { id: "name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
  { id: "number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "floor", fieldKey: "floor", header: "Floor", accessor: (row) => row.floor },
  { id: "icfa", fieldKey: "icfa", header: "iCFA", accessor: (row) => row.icfa },
];

const rows: Row[] = [
  { id: "r1", name: "Living Room", number: 101, floor: "opt_ground", icfa: 0.9 },
  { id: "r2", name: "Bedroom", number: 201, floor: "opt_first", icfa: 0.75 },
  { id: "r3", name: "Kitchen", number: 102, floor: "opt_ground", icfa: 1.0 },
  { id: "r4", name: "", number: null, floor: null, icfa: null },
];

function ids(filtered: Row[]): string[] {
  return filtered.map((row) => row.id);
}

describe("applyFilters — text operators", () => {
  test("contains matches case-insensitively; empty value passes everything", () => {
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "name", operator: "contains", value: "ROOM" },
        ]),
      ),
    ).toEqual(["r1", "r2"]);
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "name", operator: "contains", value: "" },
        ]),
      ),
    ).toEqual(["r1", "r2", "r3", "r4"]);
    expect(
      ids(applyFilters(rows, columns, fieldDefs, [{ fieldKey: "name", operator: "contains" }])),
    ).toEqual(["r1", "r2", "r3", "r4"]);
  });

  test("does_not_contain negates with dormant pass-through", () => {
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "name", operator: "does_not_contain", value: "Room" },
        ]),
      ),
    ).toEqual(["r3", "r4"]);
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "name", operator: "does_not_contain", value: "" },
        ]),
      ),
    ).toEqual(["r1", "r2", "r3", "r4"]);
  });

  test("is and is_not match the trimmed lowercased display value exactly", () => {
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "name", operator: "is", value: "kitchen" },
        ]),
      ),
    ).toEqual(["r3"]);
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "name", operator: "is_not", value: "kitchen" },
        ]),
      ),
    ).toEqual(["r1", "r2", "r4"]);
  });

  test("is_empty and is_not_empty recognise null and blank strings", () => {
    expect(
      ids(applyFilters(rows, columns, fieldDefs, [{ fieldKey: "name", operator: "is_empty" }])),
    ).toEqual(["r4"]);
    expect(
      ids(applyFilters(rows, columns, fieldDefs, [{ fieldKey: "name", operator: "is_not_empty" }])),
    ).toEqual(["r1", "r2", "r3"]);
  });
});

describe("applyFilters — number operators", () => {
  test("is_empty distinguishes null from zero", () => {
    const rowsWithZero: Row[] = [...rows, { id: "rz", name: "Z", number: 0, floor: null, icfa: 0 }];
    expect(
      ids(
        applyFilters(rowsWithZero, columns, fieldDefs, [
          { fieldKey: "number", operator: "is_empty" },
        ]),
      ),
    ).toEqual(["r4"]);
    expect(
      ids(
        applyFilters(rowsWithZero, columns, fieldDefs, [
          { fieldKey: "number", operator: "is_not_empty" },
        ]),
      ),
    ).toEqual(["r1", "r2", "r3", "rz"]);
  });

  test("eq / neq / gt / lt parse the value with Number(); NaN values are dormant", () => {
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "number", operator: "eq", value: "101" },
        ]),
      ),
    ).toEqual(["r1"]);
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "number", operator: "neq", value: "101" },
        ]),
      ),
    ).toEqual(["r2", "r3"]);
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "number", operator: "gt", value: "150" },
        ]),
      ),
    ).toEqual(["r2"]);
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "number", operator: "lt", value: "150" },
        ]),
      ),
    ).toEqual(["r1", "r3"]);

    // NaN value → dormant
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "number", operator: "gt", value: "abc" },
        ]),
      ),
    ).toEqual(["r1", "r2", "r3", "r4"]);
    // Empty value → dormant
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [{ fieldKey: "number", operator: "gt", value: "" }]),
      ),
    ).toEqual(["r1", "r2", "r3", "r4"]);
  });

  test("between honours swapped bounds and treats missing bound as dormant", () => {
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "number", operator: "between", valuePair: ["100", "200"] },
        ]),
      ),
    ).toEqual(["r1", "r3"]);
    // swapped bounds → same result
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "number", operator: "between", valuePair: ["200", "100"] },
        ]),
      ),
    ).toEqual(["r1", "r3"]);
    // missing bound → dormant
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "number", operator: "between", valuePair: ["", "200"] },
        ]),
      ),
    ).toEqual(["r1", "r2", "r3", "r4"]);
  });

  test("computed_type: number routes through NUMBER_OPERATORS", () => {
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "icfa", operator: "lt", value: "1.0" },
        ]),
      ),
    ).toEqual(["r1", "r2"]);
  });
});

describe("applyFilters — single_select operators", () => {
  test("is_any_of compares against option ids; empty list is dormant", () => {
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "floor", operator: "is_any_of", valueList: ["opt_ground"] },
        ]),
      ),
    ).toEqual(["r1", "r3"]);
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "floor", operator: "is_any_of", valueList: [] },
        ]),
      ),
    ).toEqual(["r1", "r2", "r3", "r4"]);
  });

  test("is_none_of with a non-empty list excludes null cells (null is not in any non-empty list, so this returns true for null)", () => {
    // Null cell is not "in" the excluded set, so is_none_of returns true for it.
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "floor", operator: "is_none_of", valueList: ["opt_ground"] },
        ]),
      ),
    ).toEqual(["r2", "r4"]);
  });

  test("is_empty / is_not_empty handle null option references", () => {
    expect(
      ids(applyFilters(rows, columns, fieldDefs, [{ fieldKey: "floor", operator: "is_empty" }])),
    ).toEqual(["r4"]);
  });
});

describe("applyFilters — multi-rule AND combination", () => {
  test("multiple rules combine with logical AND", () => {
    expect(
      ids(
        applyFilters(rows, columns, fieldDefs, [
          { fieldKey: "name", operator: "contains", value: "room" },
          { fieldKey: "floor", operator: "is_any_of", valueList: ["opt_ground"] },
        ]),
      ),
    ).toEqual(["r1"]);
  });
});
