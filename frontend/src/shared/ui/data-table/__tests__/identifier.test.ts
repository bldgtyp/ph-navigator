import { describe, expect, test } from "vitest";
import {
  applyIdentifierConfig,
  computeIdentifierDuplicates,
  describeDuplicateRows,
} from "../lib/identifier/resolve";
import { sanitizeViewStateForSchema } from "../lib/view/sanitize";
import { sortRows } from "../lib/sort/sortRows";
import { coercePasteWrites } from "../lib/paste/plan";
import {
  IDENTIFIER_COLUMN_ID,
  IDENTIFIER_HEADER_LABEL,
  type DataTableColumnDef,
  type FieldDef,
  type ViewState,
} from "../types";

// Pumps-like row for `kind: "field"` cases.
type PumpRow = { id: string; tag: string | null; flow_lpm: number | null };
const pumpFieldDefs: FieldDef[] = [
  { field_key: "tag", field_type: "text", display_name: "Tag", default: null },
  { field_key: "flow_lpm", field_type: "number", display_name: "Flow", default: null },
];
const pumpColumns: DataTableColumnDef<PumpRow>[] = [
  { id: "col-flow", fieldKey: "flow_lpm", header: "Flow", accessor: (row) => row.flow_lpm },
  { id: "col-tag", fieldKey: "tag", header: "Tag", accessor: (row) => row.tag },
];

// Rooms-like row for `kind: "computed"` cases.
type RoomRow = { id: string; number: string | null; name: string | null };
const roomFieldDefs: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number", default: "" },
  { field_key: "name", field_type: "text", display_name: "Name", default: "" },
];
const roomColumns: DataTableColumnDef<RoomRow>[] = [
  { id: "col-number", fieldKey: "number", header: "Number", accessor: (row) => row.number },
  { id: "col-name", fieldKey: "name", header: "Name", accessor: (row) => row.name },
];

describe("applyIdentifierConfig", () => {
  test("returns inputs unchanged when no identifier is configured", () => {
    const result = applyIdentifierConfig<PumpRow>({
      identifier: undefined,
      columnDefs: pumpColumns,
      fieldDefs: pumpFieldDefs,
    });
    expect(result.columnDefs).toBe(pumpColumns);
    expect(result.fieldDefs).toBe(pumpFieldDefs);
    expect(result.resolution).toEqual({
      kind: "off",
      columnId: null,
      broken: false,
    });
  });

  test("kind:'field' promotes backing column to slot 0 with Record-ID label", () => {
    const result = applyIdentifierConfig<PumpRow>({
      identifier: { kind: "field", field: "tag" },
      columnDefs: pumpColumns,
      fieldDefs: pumpFieldDefs,
    });
    expect(result.columnDefs[0]?.id).toBe("col-tag");
    expect(result.columnDefs[0]?.fieldKey).toBe("tag");
    expect(result.columnDefs[0]?.header).toBe(IDENTIFIER_HEADER_LABEL);
    expect(result.columnDefs[1]?.id).toBe("col-flow");
    expect(result.columnDefs).toHaveLength(2);
    // FieldDefs are not synthesized for the field kind — the existing
    // FieldDef for `tag` continues to drive editability / sort.
    expect(result.fieldDefs).toBe(pumpFieldDefs);
    expect(result.resolution.kind).toBe("field");
    expect(result.resolution.broken).toBe(false);
    if (result.resolution.kind === "field") {
      expect(result.resolution.columnId).toBe("col-tag");
      expect(result.resolution.fieldKey).toBe("tag");
      expect(result.resolution.getValue({ id: "p1", tag: "P-01", flow_lpm: 12 })).toBe("P-01");
      expect(result.resolution.getValue({ id: "p2", tag: null, flow_lpm: 0 })).toBe("");
    }
  });

  test("kind:'field' surfaces broken state when backing field is missing", () => {
    const result = applyIdentifierConfig<PumpRow>({
      identifier: { kind: "field", field: "missing" as keyof PumpRow & string },
      columnDefs: pumpColumns,
      fieldDefs: pumpFieldDefs,
    });
    expect(result.resolution.kind).toBe("field-broken");
    expect(result.resolution.broken).toBe(true);
    expect(result.resolution.columnId).toBe(IDENTIFIER_COLUMN_ID);
    expect(result.columnDefs[0]?.id).toBe(IDENTIFIER_COLUMN_ID);
    expect(result.columnDefs[0]?.accessor({ id: "p1", tag: "P-01", flow_lpm: 1 })).toBe("ERROR");
    // Synthetic FieldDef registered for the ERROR slot.
    expect(result.fieldDefs[0]?.field_key).toBe(IDENTIFIER_COLUMN_ID);
    expect(result.fieldDefs[0]?.read_only).toBe(true);
    expect(result.fieldDefs[0]?.read_only_schema).toBe(true);
  });

  test("kind:'computed' prepends synthetic __record_id__ column and FieldDef", () => {
    const compute = (room: RoomRow) => [room.number, room.name].filter(Boolean).join(" — ");
    const result = applyIdentifierConfig<RoomRow>({
      identifier: { kind: "computed", deps: ["number", "name"], compute },
      columnDefs: roomColumns,
      fieldDefs: roomFieldDefs,
    });
    expect(result.columnDefs[0]?.id).toBe(IDENTIFIER_COLUMN_ID);
    expect(result.columnDefs[0]?.fieldKey).toBe(IDENTIFIER_COLUMN_ID);
    expect(result.columnDefs[0]?.header).toBe(IDENTIFIER_HEADER_LABEL);
    expect(result.columnDefs[0]?.accessor({ id: "rm_1", number: "101", name: "Living" })).toBe(
      "101 — Living",
    );
    expect(result.columnDefs).toHaveLength(3);
    expect(result.fieldDefs[0]?.field_key).toBe(IDENTIFIER_COLUMN_ID);
    expect(result.fieldDefs[0]?.read_only).toBe(true);
    expect(result.resolution.kind).toBe("computed");
    if (result.resolution.kind === "computed") {
      expect(result.resolution.getValue({ id: "rm_1", number: "101", name: "Living" })).toBe(
        "101 — Living",
      );
    }
  });
});

describe("computeIdentifierDuplicates", () => {
  test("returns empty map when identifier is off", () => {
    const result = applyIdentifierConfig<PumpRow>({
      identifier: undefined,
      columnDefs: pumpColumns,
      fieldDefs: pumpFieldDefs,
    });
    expect(
      computeIdentifierDuplicates({
        resolution: result.resolution,
        rows: [{ id: "p1", tag: "P-01", flow_lpm: 1 }],
        getRowId: (row) => row.id,
      }).size,
    ).toBe(0);
  });

  test("marks all rows sharing an identifier value with each other's row numbers", () => {
    const result = applyIdentifierConfig<PumpRow>({
      identifier: { kind: "field", field: "tag" },
      columnDefs: pumpColumns,
      fieldDefs: pumpFieldDefs,
    });
    const rows: PumpRow[] = [
      { id: "p1", tag: "P-01", flow_lpm: 1 }, // row 1
      { id: "p2", tag: "P-02", flow_lpm: 2 }, // row 2
      { id: "p3", tag: "P-01", flow_lpm: 3 }, // row 3 — collides with p1
      { id: "p4", tag: "P-01", flow_lpm: 4 }, // row 4 — collides with p1, p3
    ];
    const duplicates = computeIdentifierDuplicates({
      resolution: result.resolution,
      rows,
      getRowId: (row) => row.id,
    });
    expect(duplicates.get("p1")).toEqual([3, 4]);
    expect(duplicates.get("p3")).toEqual([1, 4]);
    expect(duplicates.get("p4")).toEqual([1, 3]);
    expect(duplicates.has("p2")).toBe(false);
  });

  test("empty / whitespace identifiers do not warn (Plan 30 D13)", () => {
    const result = applyIdentifierConfig<PumpRow>({
      identifier: { kind: "field", field: "tag" },
      columnDefs: pumpColumns,
      fieldDefs: pumpFieldDefs,
    });
    const rows: PumpRow[] = [
      { id: "p1", tag: "", flow_lpm: 1 },
      { id: "p2", tag: null, flow_lpm: 2 },
      { id: "p3", tag: "   ", flow_lpm: 3 },
    ];
    expect(
      computeIdentifierDuplicates({
        resolution: result.resolution,
        rows,
        getRowId: (row) => row.id,
      }).size,
    ).toBe(0);
  });
});

describe("describeDuplicateRows", () => {
  test("singular phrasing for a single conflict", () => {
    expect(describeDuplicateRows([2])).toBe("Also used on row 2.");
  });

  test("explicit list up to three", () => {
    expect(describeDuplicateRows([2, 5, 8])).toBe("Also used on rows 2, 5, 8.");
  });

  test("caps at three explicit numbers and appends remainder count", () => {
    expect(describeDuplicateRows([2, 5, 8, 11, 14])).toBe(
      "Also used on rows 2, 5, 8 (and 2 more).",
    );
  });
});

describe("sortRows with synthetic __record_id__ column", () => {
  test("lexical sort on compute output (D5)", () => {
    const compute = (room: RoomRow) => [room.number, room.name].filter(Boolean).join(" — ");
    const { columnDefs, fieldDefs } = applyIdentifierConfig<RoomRow>({
      identifier: { kind: "computed", deps: ["number", "name"], compute },
      columnDefs: roomColumns,
      fieldDefs: roomFieldDefs,
    });
    const rows: RoomRow[] = [
      { id: "rm_3", number: "103", name: "Bath" },
      { id: "rm_1", number: "101", name: "Living" },
      { id: "rm_2", number: "102", name: "Kitchen" },
    ];
    const sorted = sortRows(rows, columnDefs, fieldDefs, [
      { fieldKey: IDENTIFIER_COLUMN_ID, direction: "asc" },
    ]);
    expect(sorted.map((row) => row.id)).toEqual(["rm_1", "rm_2", "rm_3"]);
  });
});

describe("sanitizeViewStateForSchema preserves __record_id__ ViewState entries", () => {
  test("does not strip sort rules, hidden columns, or widths keyed by __record_id__", () => {
    const view: ViewState = {
      filter: [],
      sort: [{ fieldKey: IDENTIFIER_COLUMN_ID, direction: "asc" }],
      group: [],
      aggregations: {},
      columnOrder: [IDENTIFIER_COLUMN_ID, "col-number"],
      columnWidths: { [IDENTIFIER_COLUMN_ID]: 220 },
      hiddenColumns: [],
      expandedGroups: {},
    };
    const sanitized = sanitizeViewStateForSchema(
      view,
      roomFieldDefs,
      roomColumns as DataTableColumnDef<unknown>[],
    );
    expect(sanitized.sort).toEqual([{ fieldKey: IDENTIFIER_COLUMN_ID, direction: "asc" }]);
    expect(sanitized.columnOrder).toContain(IDENTIFIER_COLUMN_ID);
    expect(sanitized.columnWidths[IDENTIFIER_COLUMN_ID]).toBe(220);
  });
});

describe("coercePasteWrites skips identifier cells silently", () => {
  test("paste over computed identifier increments skip count instead of erroring", () => {
    const compute = (room: RoomRow) => [room.number, room.name].filter(Boolean).join(" — ");
    const { columnDefs, fieldDefs } = applyIdentifierConfig<RoomRow>({
      identifier: { kind: "computed", deps: ["number", "name"], compute },
      columnDefs: roomColumns,
      fieldDefs: roomFieldDefs,
    });
    const rows: RoomRow[] = [{ id: "rm_1", number: "101", name: "Living" }];
    const result = coercePasteWrites({
      plannedWrites: [
        { rowIndex: 0, columnIndex: 0, raw: "anything" }, // __record_id__
        { rowIndex: 0, columnIndex: 1, raw: "202" }, // number
      ],
      rows,
      columns: columnDefs,
      fieldDefs,
      getRowId: (row) => row.id,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.writes).toEqual([{ rowId: "rm_1", fieldKey: "number", value: "202" }]);
      expect(result.skippedIdentifierCells).toBe(1);
    }
  });
});
