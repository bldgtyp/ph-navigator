import { describe, expect, test } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  computeTableSchemaFingerprint,
  useTableSchema,
  type TableFieldDef,
} from "../hooks/useTableSchema";

const tableField = (field_key: string, overrides: Partial<TableFieldDef> = {}): TableFieldDef => ({
  field_key,
  display_name: field_key.toUpperCase(),
  field_type: "short_text",
  config: {},
  description: null,
  default: null,
  origin: "custom",
  created_at: "2026-05-24T12:00:00Z",
  created_by: null,
  ...overrides,
});

describe("useTableSchema", () => {
  test("preserves persisted FieldDef order", () => {
    const fieldDefs = [
      tableField("record_id", { origin: "built_in", field_type: "formula" }),
      tableField("number", { origin: "built_in" }),
      tableField("cf_owner", { field_type: "number" }),
    ];
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        fieldDefs,
      }),
    );

    expect(result.current.fieldDefs.map((field) => field.field_key)).toEqual([
      "record_id",
      "number",
      "cf_owner",
    ]);
  });

  test("layers render-only overlay without replacing persisted display names", () => {
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        fieldDefs: [
          tableField("number", {
            origin: "built_in",
            display_name: "Room No.",
          }),
          tableField("cf_notes"),
        ],
        fieldOverlay: {
          number: {
            required: true,
            locked: ["delete", "duplicate"],
          },
        },
      }),
    );

    expect(result.current.fieldDefs[0]).toMatchObject({
      field_key: "number",
      display_name: "Room No.",
      required: true,
      locked: ["delete", "duplicate"],
      built_in: true,
    });
    expect(result.current.fieldDefs[1]?.built_in).toBeUndefined();
  });

  test("exposes only custom-origin entries as customFields", () => {
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        fieldDefs: [
          tableField("number", { origin: "built_in" }),
          tableField("cf_notes"),
          tableField("cf_owner", { field_type: "number" }),
        ],
      }),
    );

    expect(result.current.customFields.map((field) => field.field_key)).toEqual([
      "cf_notes",
      "cf_owner",
    ]);
    expect(result.current.tableFields.map((field) => field.field_key)).toEqual([
      "number",
      "cf_notes",
      "cf_owner",
    ]);
    expect(result.current.coreFieldKeys).toEqual(new Set(["number"]));
  });

  test("maps TableFieldDef field types to renderer field types", () => {
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        fieldDefs: [
          tableField("cf_a", { field_type: "short_text" }),
          tableField("cf_b", { field_type: "number" }),
          tableField("cf_c", { field_type: "formula" }),
        ],
      }),
    );
    expect(result.current.fieldDefs[0]?.field_type).toBe("text");
    expect(result.current.fieldDefs[1]?.field_type).toBe("number");
    expect(result.current.fieldDefs[2]?.field_type).toBe("computed");
  });

  test("attaches single-select options by exact or namespaced option-list key", () => {
    const { result } = renderHook(() =>
      useTableSchema({
        tableKey: "rooms",
        fieldDefs: [
          tableField("floor_level", { origin: "built_in", field_type: "single_select" }),
          tableField("cf_finish", { field_type: "single_select" }),
        ],
        singleSelectOptions: {
          "rooms.floor_level": [{ id: "opt_1", label: "Ground", color: "#111111", order: 0 }],
          "rooms.cf_finish": [{ id: "opt_2", label: "Paint", color: "#222222", order: 0 }],
        },
      }),
    );

    expect(result.current.fieldDefs[0]?.options?.[0]?.label).toBe("Ground");
    expect(result.current.fieldDefs[1]?.options?.[0]?.label).toBe("Paint");
  });

  test("fingerprint is stable across display-name changes", () => {
    const a = computeTableSchemaFingerprint([
      tableField("number", { origin: "built_in", display_name: "Number" }),
      tableField("cf_x", { display_name: "Alpha" }),
    ]);
    const b = computeTableSchemaFingerprint([
      tableField("number", { origin: "built_in", display_name: "Room No." }),
      tableField("cf_x", { display_name: "Beta" }),
    ]);
    expect(a).toEqual(b);
  });

  test("fingerprint changes when a field is added", () => {
    const empty = computeTableSchemaFingerprint([]);
    const withField = computeTableSchemaFingerprint([tableField("cf_x")]);
    expect(empty).not.toEqual(withField);
  });

  test("empty fingerprint matches the pinned backend digest", () => {
    const fp = computeTableSchemaFingerprint([]);
    // sha256 of '{"version":"v2","fields":[]}'
    expect(fp).toBe("7bb25519cabb2abaf1a6c64ca8ce25f69cd16d656604bfb58509adb79187ce90");
  });
});
