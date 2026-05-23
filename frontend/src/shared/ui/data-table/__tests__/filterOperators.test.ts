import { describe, expect, test } from "vitest";
import {
  NUMBER_OPERATORS,
  SINGLE_SELECT_OPERATORS,
  TEXT_OPERATORS,
  getFilterOperators,
  getOperatorDef,
  isFilterContributing,
} from "../fields/filterOperators";
import type { FieldDef } from "../types";

describe("getFilterOperators", () => {
  test("text fields receive the text catalogue", () => {
    const fieldDef: FieldDef = { field_key: "x", field_type: "text", display_name: "X" };
    expect(getFilterOperators(fieldDef)).toBe(TEXT_OPERATORS);
  });

  test("number fields receive the number catalogue", () => {
    const fieldDef: FieldDef = { field_key: "x", field_type: "number", display_name: "X" };
    expect(getFilterOperators(fieldDef)).toBe(NUMBER_OPERATORS);
  });

  test("single_select fields receive the single-select catalogue", () => {
    const fieldDef: FieldDef = {
      field_key: "x",
      field_type: "single_select",
      display_name: "X",
    };
    expect(getFilterOperators(fieldDef)).toBe(SINGLE_SELECT_OPERATORS);
  });

  test("computed fields with computed_type=number route to NUMBER_OPERATORS", () => {
    const fieldDef: FieldDef = {
      field_key: "x",
      field_type: "computed",
      display_name: "X",
      computed_type: "number",
    };
    expect(getFilterOperators(fieldDef)).toBe(NUMBER_OPERATORS);
  });

  test("computed fields without computed_type fall back to TEXT_OPERATORS", () => {
    const fieldDef: FieldDef = {
      field_key: "x",
      field_type: "computed",
      display_name: "X",
    };
    expect(getFilterOperators(fieldDef)).toBe(TEXT_OPERATORS);
  });

  test("attachment and argb_color fields return an empty catalogue", () => {
    expect(
      getFilterOperators({ field_key: "x", field_type: "attachment", display_name: "X" }),
    ).toHaveLength(0);
    expect(
      getFilterOperators({ field_key: "x", field_type: "argb_color", display_name: "X" }),
    ).toHaveLength(0);
  });
});

describe("isFilterContributing", () => {
  test("text/number-single operators contribute only when the value is non-blank", () => {
    expect(isFilterContributing({ fieldKey: "x", operator: "contains", value: "abc" })).toBe(true);
    expect(isFilterContributing({ fieldKey: "x", operator: "contains", value: " " })).toBe(false);
    expect(isFilterContributing({ fieldKey: "x", operator: "contains" })).toBe(false);
    expect(isFilterContributing({ fieldKey: "x", operator: "gt", value: "12" })).toBe(true);
    expect(isFilterContributing({ fieldKey: "x", operator: "gt", value: "" })).toBe(false);
  });

  test("valueless operators (is_empty / is_not_empty) always contribute", () => {
    expect(isFilterContributing({ fieldKey: "x", operator: "is_empty" })).toBe(true);
    expect(isFilterContributing({ fieldKey: "x", operator: "is_not_empty" })).toBe(true);
  });

  test("between requires both bounds parsable", () => {
    expect(
      isFilterContributing({ fieldKey: "x", operator: "between", valuePair: ["1", "5"] }),
    ).toBe(true);
    expect(isFilterContributing({ fieldKey: "x", operator: "between", valuePair: ["", "5"] })).toBe(
      false,
    );
    expect(
      isFilterContributing({ fieldKey: "x", operator: "between", valuePair: ["abc", "5"] }),
    ).toBe(false);
  });

  test("option-list operators require a non-empty list", () => {
    expect(isFilterContributing({ fieldKey: "x", operator: "is_any_of", valueList: ["a"] })).toBe(
      true,
    );
    expect(isFilterContributing({ fieldKey: "x", operator: "is_any_of", valueList: [] })).toBe(
      false,
    );
    expect(isFilterContributing({ fieldKey: "x", operator: "is_any_of" })).toBe(false);
  });
});

describe("getOperatorDef", () => {
  test("looks up an operator's definition across all catalogues", () => {
    expect(getOperatorDef("contains")?.shape.kind).toBe("string");
    expect(getOperatorDef("between")?.shape.kind).toBe("numberPair");
    expect(getOperatorDef("is_any_of")?.shape.kind).toBe("optionIdList");
    expect(getOperatorDef("is_empty")?.shape.kind).toBe("none");
  });
});
