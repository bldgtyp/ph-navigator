import { describe, expect, test } from "vitest";
import { getCustomValue, isCustomFieldKey, setCustomValue } from "../lib/customFieldAccessor";

describe("customFieldAccessor", () => {
  test("isCustomFieldKey detects the cf_ prefix", () => {
    expect(isCustomFieldKey("cf_notes")).toBe(true);
    expect(isCustomFieldKey("number")).toBe(false);
    expect(isCustomFieldKey(null)).toBe(false);
    expect(isCustomFieldKey(undefined)).toBe(false);
  });

  test("getCustomValue returns the stored value for a custom field_key", () => {
    const row = { custom_values: { cf_notes: "needs paint" } };
    expect(getCustomValue(row, { field_key: "cf_notes" })).toBe("needs paint");
  });

  test("getCustomValue returns undefined for a missing key", () => {
    const row = { custom_values: {} };
    expect(getCustomValue(row, { field_key: "cf_missing" })).toBeUndefined();
  });

  test("getCustomValue reads built-in mutable field keys", () => {
    const row = { custom_values: { name: "Living Room" } };
    expect(getCustomValue(row, { field_key: "name" })).toBe("Living Room");
  });

  test("setCustomValue writes a new value and preserves siblings", () => {
    const row = { id: "rm_1", custom_values: { cf_notes: "old" } };
    const next = setCustomValue(row, { field_key: "cf_paint" }, "blue");
    expect(next.custom_values).toEqual({ cf_notes: "old", cf_paint: "blue" });
    expect(next.id).toBe("rm_1");
    expect(row.custom_values).toEqual({ cf_notes: "old" });
  });

  test("setCustomValue deletes the key when value is undefined", () => {
    const row = { custom_values: { cf_notes: "x", cf_other: 1 } };
    const next = setCustomValue(row, { field_key: "cf_notes" }, undefined);
    expect(next.custom_values).toEqual({ cf_other: 1 });
  });

  test("setCustomValue preserves row identity for no-op writes", () => {
    const row = { custom_values: { name: "Kitchen" } };
    expect(setCustomValue(row, "name", "Kitchen")).toBe(row);
    expect(setCustomValue(row, "missing", undefined)).toBe(row);
  });

  test("setCustomValue writes built-in mutable field keys", () => {
    const next = setCustomValue({ custom_values: {} }, { field_key: "name" }, "Kitchen");
    expect(next.custom_values).toEqual({ name: "Kitchen" });
  });
});
