import { describe, expect, test } from "vitest";
import {
  getCustomValue,
  isCustomFieldKey,
  setCustomValue,
} from "../lib/customFieldAccessor";

describe("customFieldAccessor", () => {
  test("isCustomFieldKey detects the cf_ prefix", () => {
    expect(isCustomFieldKey("cf_notes")).toBe(true);
    expect(isCustomFieldKey("number")).toBe(false);
    expect(isCustomFieldKey(null)).toBe(false);
    expect(isCustomFieldKey(undefined)).toBe(false);
  });

  test("getCustomValue returns the stored value for a custom field_key", () => {
    const row = { custom: { cf_notes: "needs paint" } };
    expect(getCustomValue(row, { field_key: "cf_notes" })).toBe("needs paint");
  });

  test("getCustomValue returns undefined for a missing key", () => {
    const row = { custom: {} };
    expect(getCustomValue(row, { field_key: "cf_missing" })).toBeUndefined();
  });

  test("getCustomValue refuses a core field_key", () => {
    const row = { custom: { cf_notes: "x" } };
    expect(getCustomValue(row, { field_key: "name" })).toBeUndefined();
  });

  test("setCustomValue writes a new value and preserves siblings", () => {
    const row = { id: "rm_1", custom: { cf_notes: "old" } };
    const next = setCustomValue(row, { field_key: "cf_paint" }, "blue");
    expect(next.custom).toEqual({ cf_notes: "old", cf_paint: "blue" });
    expect(next.id).toBe("rm_1");
    expect(row.custom).toEqual({ cf_notes: "old" });
  });

  test("setCustomValue deletes the key when value is undefined", () => {
    const row = { custom: { cf_notes: "x", cf_other: 1 } };
    const next = setCustomValue(row, { field_key: "cf_notes" }, undefined);
    expect(next.custom).toEqual({ cf_other: 1 });
  });

  test("setCustomValue throws when called with a core field_key", () => {
    expect(() => setCustomValue({ custom: {} }, { field_key: "name" }, "x")).toThrow();
  });
});
