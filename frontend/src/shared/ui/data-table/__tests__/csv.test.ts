import { describe, expect, test } from "vitest";
import { sanitizeFilename, tableToCsv } from "../lib/export/csv";
import type { DataTableColumnDef, FieldDef } from "../types";

type Row = Record<string, unknown>;

function fieldMap(fieldDefs: FieldDef[]): Map<string, FieldDef> {
  return new Map(fieldDefs.map((fieldDef) => [fieldDef.field_key, fieldDef]));
}

// Strip the leading UTF-8 BOM so record assertions read naturally.
function withoutBom(content: string): string {
  return content.startsWith("﻿") ? content.slice(1) : content;
}

function records(content: string): string[] {
  // Trailing terminator yields a final empty segment; drop it.
  return withoutBom(content).split("\r\n").slice(0, -1);
}

const areaUnits = {
  mode: "editable",
  unit_type: "area",
  si_unit: "m2",
  ip_unit: "ft2",
  precision_si: 2,
  precision_ip: 2,
} as const;

describe("tableToCsv", () => {
  test("header line uses column.header and appends the active-system unit", () => {
    const columns: DataTableColumnDef<Row>[] = [
      { id: "name", fieldKey: "name", header: "Display Name", accessor: (row) => row.name },
      { id: "area", fieldKey: "area", header: "Floor Area", accessor: (row) => row.area },
    ];
    const fieldDefs = fieldMap([
      { field_key: "name", field_type: "text", display_name: "Display Name" },
      {
        field_key: "area",
        field_type: "number",
        display_name: "Floor Area",
        numberUnits: areaUnits,
      },
    ]);

    const si = tableToCsv({
      rows: [],
      columns,
      fieldDefByKey: fieldDefs,
      unitSystem: "SI",
      tableName: "Rooms",
    });
    expect(records(si.content)[0]).toBe("Display Name,Floor Area (m2)");

    const ip = tableToCsv({
      rows: [],
      columns,
      fieldDefByKey: fieldDefs,
      unitSystem: "IP",
      tableName: "Rooms",
    });
    expect(records(ip.content)[0]).toBe("Display Name,Floor Area (ft2)");
  });

  test("single_select serializes the option label; empty / missing-option → ''", () => {
    const columns: DataTableColumnDef<Row>[] = [
      { id: "status", fieldKey: "status", header: "Status", accessor: (row) => row.status },
    ];
    const fieldDefs = fieldMap([
      {
        field_key: "status",
        field_type: "single_select",
        display_name: "Status",
        options: [
          { id: "opt_a", label: "Active", color: "#0a0", order: 0 },
          { id: "opt_b", label: "Done", color: "#00a", order: 1 },
        ],
      },
    ]);

    const result = tableToCsv({
      rows: [{ status: "opt_b" }, { status: "opt_missing" }, { status: null }],
      columns,
      fieldDefByKey: fieldDefs,
      unitSystem: "SI",
      tableName: "T",
    });
    expect(records(result.content)).toEqual(["Status", "Done", "", ""]);
  });

  test("computed value serializes as text; a computed-error cell → ''", () => {
    const columns: DataTableColumnDef<Row>[] = [
      { id: "label", fieldKey: "label", header: "Label", accessor: (row) => row.label },
    ];
    const fieldDefs = fieldMap([
      { field_key: "label", field_type: "computed", display_name: "Label" },
    ]);

    const result = tableToCsv({
      rows: [{ label: "2 — Kitchen" }, { label: { error: "div_by_zero" } }],
      columns,
      fieldDefByKey: fieldDefs,
      unitSystem: "SI",
      tableName: "T",
    });
    expect(records(result.content)).toEqual(["Label", "2 — Kitchen", ""]);
  });

  test("number+units values render in the active system", () => {
    const columns: DataTableColumnDef<Row>[] = [
      { id: "area", fieldKey: "area", header: "Floor Area", accessor: (row) => row.area },
    ];
    const fieldDefs = fieldMap([
      {
        field_key: "area",
        field_type: "number",
        display_name: "Floor Area",
        numberUnits: areaUnits,
      },
    ]);
    // Canonical SI is m²; 10 m² ≈ 107.64 ft².
    const rows = [{ area: 10 }];

    expect(
      records(
        tableToCsv({ rows, columns, fieldDefByKey: fieldDefs, unitSystem: "SI", tableName: "T" })
          .content,
      ),
    ).toEqual(["Floor Area (m2)", "10.00"]);
    expect(
      records(
        tableToCsv({ rows, columns, fieldDefByKey: fieldDefs, unitSystem: "IP", tableName: "T" })
          .content,
      ),
    ).toEqual(["Floor Area (ft2)", "107.64"]);
  });

  test("RFC-4180 quotes commas, doubles embedded quotes, and quotes newlines", () => {
    const columns: DataTableColumnDef<Row>[] = [
      { id: "v", fieldKey: "v", header: "Value", accessor: (row) => row.v },
    ];
    const fieldDefs = fieldMap([{ field_key: "v", field_type: "text", display_name: "Value" }]);

    const result = tableToCsv({
      rows: [{ v: "a,b" }, { v: 'she said "hi"' }, { v: "line1\nline2" }, { v: "plain" }],
      columns,
      fieldDefByKey: fieldDefs,
      unitSystem: "SI",
      tableName: "T",
    });
    expect(records(result.content)).toEqual([
      "Value",
      '"a,b"',
      '"she said ""hi"""',
      '"line1\nline2"',
      "plain",
    ]);
  });

  test("empty rows produce a header-only file with a trailing terminator", () => {
    const columns: DataTableColumnDef<Row>[] = [
      { id: "v", fieldKey: "v", header: "Value", accessor: (row) => row.v },
    ];
    const fieldDefs = fieldMap([{ field_key: "v", field_type: "text", display_name: "Value" }]);

    const result = tableToCsv({
      rows: [],
      columns,
      fieldDefByKey: fieldDefs,
      unitSystem: "SI",
      tableName: "T",
    });
    expect(result.content).toBe("﻿Value\r\n");
  });

  test("content begins with the UTF-8 BOM and separates records with CRLF", () => {
    const columns: DataTableColumnDef<Row>[] = [
      { id: "v", fieldKey: "v", header: "Value", accessor: (row) => row.v },
    ];
    const fieldDefs = fieldMap([{ field_key: "v", field_type: "text", display_name: "Value" }]);

    const result = tableToCsv({
      rows: [{ v: "one" }, { v: "two" }],
      columns,
      fieldDefByKey: fieldDefs,
      unitSystem: "SI",
      tableName: "T",
    });
    expect(result.content.charCodeAt(0)).toBe(0xfeff);
    expect(result.content).toBe("﻿Value\r\none\r\ntwo\r\n");
  });

  test("filename comes from the sanitized table name", () => {
    const columns: DataTableColumnDef<Row>[] = [
      { id: "v", fieldKey: "v", header: "Value", accessor: (row) => row.v },
    ];
    const fieldDefs = fieldMap([{ field_key: "v", field_type: "text", display_name: "Value" }]);
    const result = tableToCsv({
      rows: [],
      columns,
      fieldDefByKey: fieldDefs,
      unitSystem: "SI",
      tableName: "Glazing Types",
    });
    expect(result.filename).toBe("Glazing Types.csv");
  });
});

describe("sanitizeFilename", () => {
  test("replaces filesystem-illegal characters with '-'", () => {
    expect(sanitizeFilename('a/b:c*d?e"f<g>h|i\\j')).toBe("a-b-c-d-e-f-g-h-i-j");
  });

  test("preserves spaces", () => {
    expect(sanitizeFilename("Glazing Types")).toBe("Glazing Types");
  });

  test("falls back to 'table' when nothing usable remains", () => {
    expect(sanitizeFilename("   ")).toBe("table");
    expect(sanitizeFilename("///")).toBe("table");
    expect(sanitizeFilename("")).toBe("table");
  });
});
