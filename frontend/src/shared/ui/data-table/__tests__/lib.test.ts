// @size-exception: planning/features/data-table-ui/phases/phase-01-numeric-alignment-and-precision.md
import { describe, expect, test } from "vitest";
import { applyFilters, defaultOperatorForField } from "../lib/filter/apply";
import {
  buildEmptyRowDefaults,
  coerceFieldValue,
  extractRowDefaults,
  naturalZero,
} from "../lib/rows/defaults";
import { formatDisplayCellValue } from "../lib/rows/format";
import { coercePasteWrites, planPaste } from "../lib/paste/plan";
import { formatClipboardCellValue, parseTsv, rangeToTsv } from "../lib/paste/tsv";
import { computeEdgeBits } from "../lib/range/edgeBits";
import { isCellInRange } from "../lib/range/normalize";
import { moveActiveCell } from "../lib/range/move";
import { sortRows } from "../lib/sort/sortRows";
import type { DataTableColumnDef, FieldDef, LinkedRecordCellOps } from "../types";

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
      applyFilters(rows, columns, fieldDefs, [
        { fieldKey: "name", operator: "contains", value: "kit" },
      ]).map((row) => row.id),
    ).toEqual(["rm_2"]);
    expect(
      applyFilters(rows, columns, fieldDefs, [
        { fieldKey: "name", operator: "is", value: "BEDROOM" },
      ]).map((row) => row.id),
    ).toEqual(["rm_10"]);
    expect(
      applyFilters(rows, columns, fieldDefs, [
        { fieldKey: "name", operator: "contains", value: "" },
      ]).map((row) => row.id),
    ).toEqual(["rm_2", "rm_10"]);
  });

  test("filters empty cell values", () => {
    const rowsWithEmpty: Row[] = [...rows, { id: "rm_empty", number: "11", name: "" }];

    expect(
      applyFilters(rowsWithEmpty, columns, fieldDefs, [
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

  test("sorts linked records by their rendered labels instead of opaque ids", () => {
    type LinkedRow = { id: string; ventilator: string[] };
    const linkedRows: LinkedRow[] = [
      { id: "rm_system_2", ventilator: ["vent_aaa"] },
      { id: "rm_system_1", ventilator: ["vent_zzz"] },
    ];
    const linkedColumns: DataTableColumnDef<LinkedRow>[] = [
      {
        id: "ventilator",
        fieldKey: "rooms.ventilator",
        header: "Ventilator",
        accessor: (row) => row.ventilator,
      },
    ];
    const linkedFields: FieldDef[] = [
      {
        field_key: "rooms.ventilator",
        field_type: "linked_record",
        display_name: "Ventilator",
      },
    ];
    const ops: LinkedRecordCellOps = {
      candidates: [],
      resolve: (rowId) => ({ recordId: rowId === "vent_aaa" ? "System-2" : "System-1" }),
    };

    expect(
      sortRows(
        linkedRows,
        linkedColumns,
        linkedFields,
        [{ fieldKey: "rooms.ventilator", direction: "asc" }],
        new Map([["rooms.ventilator", ops]]),
      ).map((row) => row.id),
    ).toEqual(["rm_system_1", "rm_system_2"]);
  });

  test("filters linked records by selected ids while names remain presentation-only", () => {
    type LinkedRow = { id: string; ventilator: string[] };
    const linkedRows: LinkedRow[] = [
      { id: "rm_system_2", ventilator: ["vent_aaa"] },
      { id: "rm_system_1", ventilator: ["vent_zzz"] },
      { id: "rm_unassigned", ventilator: [] },
    ];
    const linkedColumns: DataTableColumnDef<LinkedRow>[] = [
      {
        id: "ventilator",
        fieldKey: "rooms.ventilator",
        header: "Ventilator",
        accessor: (row) => row.ventilator,
      },
    ];
    const linkedFields: FieldDef[] = [
      {
        field_key: "rooms.ventilator",
        field_type: "linked_record",
        display_name: "Ventilator",
      },
    ];

    expect(
      applyFilters(linkedRows, linkedColumns, linkedFields, [
        {
          fieldKey: "rooms.ventilator",
          operator: "is_any_of",
          valueList: ["vent_zzz"],
        },
      ]).map((row) => row.id),
    ).toEqual(["rm_system_1"]);
    expect(
      applyFilters(linkedRows, linkedColumns, linkedFields, [
        { fieldKey: "rooms.ventilator", operator: "is_empty" },
      ]).map((row) => row.id),
    ).toEqual(["rm_unassigned"]);
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

  test("paste coercion rejects unknown labels for locked single-select options", () => {
    const selectColumns: DataTableColumnDef<Row>[] = [
      { id: "status", fieldKey: "status", header: "Status", accessor: () => null },
    ];
    const selectFields: FieldDef[] = [
      {
        field_key: "status",
        field_type: "single_select",
        display_name: "Status",
        locked: ["options"],
        options: [{ id: "opt_needed", label: "Needed", color: "#d97706", order: 0 }],
      },
    ];

    const result = coercePasteWrites({
      plannedWrites: [{ rowIndex: 0, columnIndex: 0, raw: "Custom" }],
      rows,
      columns: selectColumns,
      fieldDefs: selectFields,
      getRowId: (row) => row.id,
    });

    expect(result).toEqual({
      ok: false,
      errors: [
        {
          rowIndex: 0,
          columnIndex: 0,
          raw: "Custom",
          message: "Status does not allow new options.",
        },
      ],
    });
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

  test("extractRowDefaults reads anchor row values via column accessors", () => {
    const anchor: Row = { id: "rm_5", number: "5", name: "Living" };
    expect(extractRowDefaults(anchor, fieldDefs, columns)).toEqual({
      number: "5",
      name: "Living",
    });
  });

  test("extractRowDefaults falls back to FieldDef.default when no column accessor exists", () => {
    const anchor: Row = { id: "rm_5", number: "5", name: "Living" };
    const extra: FieldDef = {
      field_key: "icfa_factor",
      field_type: "number",
      display_name: "iCFA",
      default: 1,
    };
    expect(extractRowDefaults(anchor, [...fieldDefs, extra], columns)).toEqual({
      number: "5",
      name: "Living",
      icfa_factor: 1,
    });
  });

  test("extractRowDefaults falls back to naturalZero when neither column nor default exists", () => {
    const anchor: Row = { id: "rm_5", number: "5", name: "Living" };
    const extras: FieldDef[] = [
      { field_key: "notes", field_type: "text", display_name: "Notes" },
      { field_key: "num_people", field_type: "number", display_name: "People" },
      { field_key: "zone", field_type: "single_select", display_name: "Zone" },
    ];
    expect(extractRowDefaults(anchor, [...fieldDefs, ...extras], columns)).toEqual({
      number: "5",
      name: "Living",
      notes: "",
      num_people: 0,
      zone: null,
    });
  });

  test("buildEmptyRowDefaults uses FieldDef.default when present, else naturalZero", () => {
    const defs: FieldDef[] = [
      { field_key: "number", field_type: "text", display_name: "Number", default: "" },
      { field_key: "name", field_type: "text", display_name: "Name" },
      {
        field_key: "icfa_factor",
        field_type: "number",
        display_name: "iCFA",
        default: 1,
      },
      { field_key: "floor", field_type: "single_select", display_name: "Floor" },
    ];
    expect(buildEmptyRowDefaults(defs)).toEqual({
      number: "",
      name: "",
      icfa_factor: 1,
      floor: null,
    });
  });

  test("naturalZero maps each FieldType to its empty-cell representation", () => {
    expect(naturalZero("text")).toBe("");
    expect(naturalZero("number")).toBe(0);
    expect(naturalZero("single_select")).toBeNull();
    expect(naturalZero("computed")).toBeNull();
    expect(naturalZero("attachment")).toBeNull();
    expect(naturalZero("color")).toBeNull();
  });

  test("coerceFieldValue maps blank nullable cells to null", () => {
    expect(
      coerceFieldValue(
        "",
        { field_key: "name", field_type: "text", display_name: "Name" },
        () => [],
      ),
    ).toEqual({
      ok: true,
      value: null,
    });
    expect(
      coerceFieldValue(
        "",
        { field_key: "count", field_type: "number", display_name: "Count" },
        () => [],
      ),
    ).toEqual({
      ok: true,
      value: null,
    });
    expect(
      coerceFieldValue(
        "",
        { field_key: "floor", field_type: "single_select", display_name: "Floor" },
        () => [],
      ),
    ).toEqual({ ok: true, value: null });
  });

  test("coerceFieldValue rejects blank required cells", () => {
    const required = { required: true };
    expect(
      coerceFieldValue(
        "",
        { ...required, field_key: "name", field_type: "text", display_name: "Name" },
        () => [],
      ),
    ).toEqual({ ok: false, message: "Value required." });
    expect(
      coerceFieldValue(
        "",
        { ...required, field_key: "count", field_type: "number", display_name: "Count" },
        () => [],
      ),
    ).toEqual({ ok: false, message: "Value required." });
    expect(
      coerceFieldValue(
        "",
        { ...required, field_key: "floor", field_type: "single_select", display_name: "Floor" },
        () => [],
      ),
    ).toEqual({ ok: false, message: "Value required." });
  });

  test("computeEdgeBits returns all-false outside the range", () => {
    const range = { rowStart: 1, rowEnd: 2, columnStart: 1, columnEnd: 2 };
    expect(computeEdgeBits(0, 0, range)).toEqual({
      top: false,
      right: false,
      bottom: false,
      left: false,
    });
    expect(computeEdgeBits(3, 1, range)).toEqual({
      top: false,
      right: false,
      bottom: false,
      left: false,
    });
  });

  test("computeEdgeBits for a 1x1 range returns all-true", () => {
    const range = { rowStart: 2, rowEnd: 2, columnStart: 3, columnEnd: 3 };
    expect(computeEdgeBits(2, 3, range)).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: true,
    });
  });

  test("computeEdgeBits along a 1xN range marks top+bottom always and left/right only at the ends", () => {
    const range = { rowStart: 0, rowEnd: 0, columnStart: 0, columnEnd: 2 };
    expect(computeEdgeBits(0, 0, range)).toEqual({
      top: true,
      right: false,
      bottom: true,
      left: true,
    });
    expect(computeEdgeBits(0, 1, range)).toEqual({
      top: true,
      right: false,
      bottom: true,
      left: false,
    });
    expect(computeEdgeBits(0, 2, range)).toEqual({
      top: true,
      right: true,
      bottom: true,
      left: false,
    });
  });

  test("computeEdgeBits along an Nx1 range marks left+right always and top/bottom only at the ends", () => {
    const range = { rowStart: 0, rowEnd: 2, columnStart: 5, columnEnd: 5 };
    expect(computeEdgeBits(0, 5, range)).toEqual({
      top: true,
      right: true,
      bottom: false,
      left: true,
    });
    expect(computeEdgeBits(1, 5, range)).toEqual({
      top: false,
      right: true,
      bottom: false,
      left: true,
    });
    expect(computeEdgeBits(2, 5, range)).toEqual({
      top: false,
      right: true,
      bottom: true,
      left: true,
    });
  });

  test("computeEdgeBits for an NxM range marks corners, edges, and interiors correctly", () => {
    const range = { rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2 };
    expect(computeEdgeBits(0, 0, range)).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: true,
    });
    expect(computeEdgeBits(0, 2, range)).toEqual({
      top: true,
      right: true,
      bottom: false,
      left: false,
    });
    expect(computeEdgeBits(2, 0, range)).toEqual({
      top: false,
      right: false,
      bottom: true,
      left: true,
    });
    expect(computeEdgeBits(2, 2, range)).toEqual({
      top: false,
      right: true,
      bottom: true,
      left: false,
    });
    expect(computeEdgeBits(0, 1, range)).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: false,
    });
    expect(computeEdgeBits(1, 1, range)).toEqual({
      top: false,
      right: false,
      bottom: false,
      left: false,
    });
  });

  test("applyFilters returns the same array identity when there are no active filters", () => {
    const result = applyFilters(rows, columns, fieldDefs, []);
    expect(result).toBe(rows);
  });

  test("applyFilters returns a new array when any rule is active", () => {
    const result = applyFilters(rows, columns, fieldDefs, [
      { fieldKey: "name", operator: "contains", value: "kit" },
    ]);
    expect(result).not.toBe(rows);
    expect(result.map((row) => row.id)).toEqual(["rm_2"]);
  });

  test("defaultOperatorForField picks the catalogue's first operator per field type", () => {
    expect(defaultOperatorForField({ field_key: "x", field_type: "text", display_name: "X" })).toBe(
      "contains",
    );
    expect(
      defaultOperatorForField({ field_key: "x", field_type: "number", display_name: "X" }),
    ).toBe("eq");
    expect(
      defaultOperatorForField({
        field_key: "x",
        field_type: "single_select",
        display_name: "X",
      }),
    ).toBe("is_any_of");
    expect(
      defaultOperatorForField({ field_key: "x", field_type: "computed", display_name: "X" }),
    ).toBe("contains");
    expect(
      defaultOperatorForField({
        field_key: "x",
        field_type: "computed",
        display_name: "X",
        computed_type: "number",
      }),
    ).toBe("eq");
    expect(
      defaultOperatorForField({
        field_key: "x",
        field_type: "attachment",
        display_name: "X",
      }),
    ).toBeNull();
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

  test("formats plain number display values with configured precision", () => {
    const fieldDef: FieldDef = {
      field_key: "cf_load",
      field_type: "number",
      display_name: "Load",
      numberPrecision: 2,
    };

    expect(formatDisplayCellValue(12.3, fieldDef)).toBe("12.30");
    expect(formatDisplayCellValue("12.345", { ...fieldDef, numberPrecision: 1 })).toBe("12.3");
    expect(formatDisplayCellValue(12.9, { ...fieldDef, numberPrecision: 0 })).toBe("13");
  });

  test("keeps plain number clipboard values on the display precision seam", () => {
    const fieldDef: FieldDef = {
      field_key: "cf_load",
      field_type: "number",
      display_name: "Load",
      numberPrecision: 3,
    };

    expect(formatClipboardCellValue(1.2, fieldDef)).toBe("1.200");
  });

  test("formats number-with-units values with active-system precision", () => {
    const fieldDef: FieldDef = {
      field_key: "thickness",
      field_type: "number",
      display_name: "Thickness",
      numberPrecision: 0,
      numberUnits: {
        mode: "editable",
        unit_type: "length",
        si_unit: "m",
        ip_unit: "ft",
        precision_si: 3,
        precision_ip: 1,
      },
    };

    expect(formatDisplayCellValue(1, fieldDef, "SI")).toBe("1.000");
    expect(formatDisplayCellValue(1, fieldDef, "IP")).toBe("3.3");
  });

  test("formats a numeric formula (computed) with units — clipboard/CSV parity (Phase 3)", () => {
    const fieldDef: FieldDef = {
      field_key: "cf_flow",
      field_type: "computed",
      display_name: "Supply",
      numberUnits: {
        mode: "editable",
        unit_type: "airflow",
        si_unit: "m3_h",
        ip_unit: "cfm",
        precision_si: 1,
        precision_ip: 1,
      },
    };

    expect(formatDisplayCellValue(259.7, fieldDef, "SI")).toBe("259.7");
    expect(formatDisplayCellValue(259.7, fieldDef, "IP")).toBe("152.9");
    // A formula error overlay is an object, not a number — never unit-formatted.
    expect(formatDisplayCellValue({ error: "div_by_zero" }, fieldDef, "IP")).not.toContain("cfm");
    // Clipboard / TSV path matches the grid — same unit-formatted value.
    expect(formatClipboardCellValue(259.7, fieldDef, "IP")).toBe("152.9");
  });
});
