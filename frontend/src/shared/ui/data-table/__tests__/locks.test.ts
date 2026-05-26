// Plan-31 Phase 1a — lock-list helper unit coverage.
import { describe, expect, test } from "vitest";
import {
  FIELD_LOCKED_TOOLTIP,
  isAttributeLocked,
  isBuiltInField,
  isFieldDeletable,
  isFieldDuplicable,
} from "../lib/locks";
import type { FieldDef } from "../types";

const builtIn: FieldDef = {
  field_key: "name",
  field_type: "text",
  display_name: "Name",
  built_in: true,
  locked: ["delete", "duplicate"],
};

const custom: FieldDef = {
  field_key: "cf_notes",
  field_type: "text",
  custom_field_type: "short_text",
  display_name: "Notes",
};

describe("isAttributeLocked", () => {
  test("returns true for keys present in the lock list", () => {
    expect(isAttributeLocked(builtIn, "delete")).toBe(true);
    expect(isAttributeLocked(builtIn, "duplicate")).toBe(true);
  });

  test("returns false for keys absent from the lock list", () => {
    expect(isAttributeLocked(builtIn, "display_name")).toBe(false);
    expect(isAttributeLocked(builtIn, "field_type")).toBe(false);
  });

  test("returns false when the FieldDef has no `locked` array", () => {
    expect(isAttributeLocked(custom, "delete")).toBe(false);
    expect(isAttributeLocked(custom, "field_type")).toBe(false);
  });

  test("tolerates null / undefined input", () => {
    expect(isAttributeLocked(null, "delete")).toBe(false);
    expect(isAttributeLocked(undefined, "delete")).toBe(false);
  });
});

describe("isBuiltInField", () => {
  test("true only when `built_in: true` is set on the FieldDef", () => {
    expect(isBuiltInField(builtIn)).toBe(true);
    expect(isBuiltInField(custom)).toBe(false);
    expect(isBuiltInField(null)).toBe(false);
  });
});

describe("isFieldDeletable / isFieldDuplicable", () => {
  test("built-ins with the default lock list are neither deletable nor duplicable", () => {
    expect(isFieldDeletable(builtIn)).toBe(false);
    expect(isFieldDuplicable(builtIn)).toBe(false);
  });

  test("custom fields (no lock list) are both deletable and duplicable", () => {
    expect(isFieldDeletable(custom)).toBe(true);
    expect(isFieldDuplicable(custom)).toBe(true);
  });

  test("a built-in seed without 'delete' in its lock list IS deletable", () => {
    const unlocked: FieldDef = { ...builtIn, locked: [] };
    expect(isFieldDeletable(unlocked)).toBe(true);
  });
});

test("FIELD_LOCKED_TOOLTIP is the uniform Q-F5 string", () => {
  expect(FIELD_LOCKED_TOOLTIP).toBe("Field Locked");
});
