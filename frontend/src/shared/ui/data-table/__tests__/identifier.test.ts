import { describe, expect, test } from "vitest";
import {
  computeIdentifierDuplicates,
  describeDuplicateRows,
  identifierColumnId,
  RECORD_ID_FIELD_KEY,
} from "../lib/identifier/recordId";
import { sanitizeViewStateForSchema } from "../lib/view/sanitize";
import { sortRows } from "../lib/sort/sortRows";
import type { DataTableColumnDef, FieldDef, ViewState } from "../types";

type PumpRow = { id: string; record_id: string | null; flow_lpm: number | null };

const pumpFieldDefs: FieldDef[] = [
  { field_key: RECORD_ID_FIELD_KEY, field_type: "text", display_name: "Tag", default: null },
  { field_key: "flow_lpm", field_type: "number", display_name: "Flow", default: null },
];

const pumpColumns: DataTableColumnDef<PumpRow>[] = [
  { id: "col-flow", fieldKey: "flow_lpm", header: "Flow", accessor: (row) => row.flow_lpm },
  {
    id: "col-record-id",
    fieldKey: RECORD_ID_FIELD_KEY,
    header: "Display Name",
    accessor: (row) => row.record_id,
    isIdentifier: true,
  },
];

describe("identifier pinning", () => {
  test("returns null when no column is flagged the identifier", () => {
    expect(identifierColumnId([{ ...pumpColumns[0]!, id: "flow-only" }])).toBeNull();
  });

  test("returns the id of the column flagged the identifier", () => {
    expect(identifierColumnId(pumpColumns)).toBe("col-record-id");
  });
});

describe("computeIdentifierDuplicates", () => {
  test("returns empty map when no column is flagged the identifier", () => {
    expect(
      computeIdentifierDuplicates({
        columns: [pumpColumns[0]!],
        rows: [{ id: "p1", record_id: "P-01", flow_lpm: 1 }],
        getRowId: (row) => row.id,
      }).size,
    ).toBe(0);
  });

  test("marks all rows sharing a record_id value with each other's row numbers", () => {
    const rows: PumpRow[] = [
      { id: "p1", record_id: "P-01", flow_lpm: 1 },
      { id: "p2", record_id: "P-02", flow_lpm: 2 },
      { id: "p3", record_id: "P-01", flow_lpm: 3 },
      { id: "p4", record_id: "P-01", flow_lpm: 4 },
    ];
    const duplicates = computeIdentifierDuplicates({
      columns: pumpColumns,
      rows,
      getRowId: (row) => row.id,
    });
    expect(duplicates.get("p1")).toEqual({ rowNumbers: [3, 4], totalOthers: 2 });
    expect(duplicates.get("p3")).toEqual({ rowNumbers: [1, 4], totalOthers: 2 });
    expect(duplicates.get("p4")).toEqual({ rowNumbers: [1, 3], totalOthers: 2 });
    expect(duplicates.has("p2")).toBe(false);
  });

  test("empty / whitespace record_id values do not warn", () => {
    const rows: PumpRow[] = [
      { id: "p1", record_id: "", flow_lpm: 1 },
      { id: "p2", record_id: null, flow_lpm: 2 },
      { id: "p3", record_id: "   ", flow_lpm: 3 },
    ];
    expect(
      computeIdentifierDuplicates({
        columns: pumpColumns,
        rows,
        getRowId: (row) => row.id,
      }).size,
    ).toBe(0);
  });
});

describe("describeDuplicateRows", () => {
  test("singular phrasing for a single conflict", () => {
    expect(describeDuplicateRows({ rowNumbers: [2], totalOthers: 1 })).toBe("Also used on row 2.");
  });

  test("explicit list up to three", () => {
    expect(describeDuplicateRows({ rowNumbers: [2, 5, 8], totalOthers: 3 })).toBe(
      "Also used on rows 2, 5, 8.",
    );
  });

  test("caps at three explicit numbers and appends remainder count", () => {
    expect(describeDuplicateRows({ rowNumbers: [2, 5, 8], totalOthers: 5 })).toBe(
      "Also used on rows 2, 5, 8 (and 2 more).",
    );
  });
});

describe("sortRows with real record_id column", () => {
  test("lexical sort uses the record_id accessor", () => {
    const rows: PumpRow[] = [
      { id: "p3", record_id: "P-03", flow_lpm: 3 },
      { id: "p1", record_id: "P-01", flow_lpm: 1 },
      { id: "p2", record_id: "P-02", flow_lpm: 2 },
    ];
    const sorted = sortRows(rows, pumpColumns, pumpFieldDefs, [
      { fieldKey: RECORD_ID_FIELD_KEY, direction: "asc" },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["p1", "p2", "p3"]);
  });
});

describe("sanitizeViewStateForSchema with record_id", () => {
  test("keeps record_id view entries only when the real column exists", () => {
    const view: ViewState = {
      filter: [],
      sort: [{ fieldKey: RECORD_ID_FIELD_KEY, direction: "asc" }],
      group: [],
      aggregations: {},
      columnOrder: ["col-record-id", "col-flow"],
      columnWidths: { "col-record-id": 220 },
      hiddenColumns: [],
      expandedGroups: {},
    };
    const sanitized = sanitizeViewStateForSchema(
      view,
      pumpFieldDefs,
      pumpColumns as DataTableColumnDef<unknown>[],
    );
    expect(sanitized.sort).toEqual([{ fieldKey: RECORD_ID_FIELD_KEY, direction: "asc" }]);
    expect(sanitized.columnOrder).toContain("col-record-id");
    expect(sanitized.columnWidths["col-record-id"]).toBe(220);
  });
});
