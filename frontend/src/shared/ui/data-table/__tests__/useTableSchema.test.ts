import { describe, expect, test } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  computeTableSchemaFingerprint,
  useTableSchema,
  type CustomFieldDef,
} from "../hooks/useTableSchema";
import type { FieldDef } from "../types";

const coreFieldDefs: FieldDef[] = [
  { field_key: "number", field_type: "text", display_name: "Number", required: true },
  { field_key: "name", field_type: "text", display_name: "Name", required: true },
];

const customField = (id: string, overrides: Partial<CustomFieldDef> = {}): CustomFieldDef => ({
  id,
  field_key: null,
  display_name: id.toUpperCase(),
  field_type: "short_text",
  config: {},
  description: null,
  created_at: "2026-05-24T12:00:00Z",
  created_by: null,
  ...overrides,
});

describe("useTableSchema", () => {
  test("merges core and custom field defs in core-then-custom order", () => {
    const customFields = [
      customField("cf_notes"),
      customField("cf_owner", { field_type: "number" }),
    ];
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        coreFieldDefs,
        customFields,
      }),
    );

    expect(result.current.fieldDefs).toHaveLength(4);
    expect(result.current.fieldDefs[0]?.field_key).toBe("number");
    expect(result.current.fieldDefs[1]?.field_key).toBe("name");
    expect(result.current.fieldDefs[2]?.field_key).toBe("cf_notes");
    expect(result.current.fieldDefs[3]?.field_key).toBe("cf_owner");
  });

  test("passes seed FieldDef shape through verbatim — no read_only_schema stamping", () => {
    const seedWithLocks: FieldDef[] = coreFieldDefs.map((fieldDef) => ({
      ...fieldDef,
      built_in: true,
      locked: ["delete", "duplicate"],
    }));
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        coreFieldDefs: seedWithLocks,
        customFields: [customField("cf_notes")],
      }),
    );

    expect(result.current.fieldDefs[0]?.built_in).toBe(true);
    expect(result.current.fieldDefs[0]?.locked).toEqual(["delete", "duplicate"]);
    expect(result.current.fieldDefs[1]?.built_in).toBe(true);
    expect(result.current.fieldDefs[2]?.built_in).toBeUndefined();
    expect(result.current.fieldDefs[2]?.locked).toBeUndefined();
  });

  test("custom FieldDef.field_key is the cf_* id", () => {
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        coreFieldDefs: [],
        customFields: [customField("cf_paint", { field_key: "u_paint" })],
      }),
    );
    expect(result.current.fieldDefs[0]?.field_key).toBe("cf_paint");
  });

  test("maps CustomFieldType to browser FieldType", () => {
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        coreFieldDefs: [],
        customFields: [
          customField("cf_a", { field_type: "short_text" }),
          customField("cf_b", { field_type: "number" }),
          customField("cf_c", { field_type: "formula" }),
        ],
      }),
    );
    expect(result.current.fieldDefs[0]?.field_type).toBe("text");
    expect(result.current.fieldDefs[1]?.field_type).toBe("number");
    expect(result.current.fieldDefs[2]?.field_type).toBe("computed");
  });

  test("fingerprint is stable across display-name changes", () => {
    const a = computeTableSchemaFingerprint(
      ["number", "name"],
      [customField("cf_x", { display_name: "Alpha" })],
    );
    const b = computeTableSchemaFingerprint(
      ["number", "name"],
      [customField("cf_x", { display_name: "Beta" })],
    );
    expect(a).toEqual(b);
  });

  test("fingerprint changes when a custom field is added", () => {
    const empty = computeTableSchemaFingerprint(["number", "name"], []);
    const withField = computeTableSchemaFingerprint(["number", "name"], [customField("cf_x")]);
    expect(empty).not.toEqual(withField);
  });

  test("fingerprint can use backend core keys without rendering hidden core fields", () => {
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        coreFieldDefs,
        fingerprintCoreFieldKeys: ["id", "number", "name", "notes"],
        customFields: [customField("cf_notes")],
      }),
    );

    expect(result.current.fieldDefs.map((field) => field.field_key)).toEqual([
      "number",
      "name",
      "cf_notes",
    ]);
    expect(result.current.schemaFingerprint).toBe(
      computeTableSchemaFingerprint(["id", "number", "name", "notes"], [customField("cf_notes")]),
    );
  });

  // Parity smoke against the backend: the SHA-256 of the canonical
  // payload {"version":"v1","core":[],"custom":[]} must equal what
  // backend `compute_table_schema_fingerprint([], [])` produces. The
  // backend version is exercised in the pytest fingerprint test —
  // here we pin the digest so a drift in either side's algorithm fails
  // CI immediately.
  test("empty fingerprint matches the pinned backend digest", () => {
    const fp = computeTableSchemaFingerprint([], []);
    // sha256 of '{"version":"v1","core":[],"custom":[]}'
    expect(fp).toBe("772b20d9f9c95ebdcfa91c32911c49bb11afca08bf70c61e2838c429cc5873b5");
  });
});
