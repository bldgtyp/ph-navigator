import { describe, expect, test } from "vitest";
import {
  formatAggregation,
  getAggregationKinds,
  NUMBER_AGGREGATIONS,
  SINGLE_SELECT_AGGREGATIONS,
  TEXT_AGGREGATIONS,
} from "../fields/aggregations";
import type { FieldDef } from "../types";

const textField: FieldDef = { field_key: "name", field_type: "text", display_name: "Name" };
const numberField: FieldDef = {
  field_key: "icfa",
  field_type: "number",
  display_name: "iCFA",
};
const singleSelectField: FieldDef = {
  field_key: "floor",
  field_type: "single_select",
  display_name: "Floor",
};
const computedNumberField: FieldDef = {
  field_key: "area",
  field_type: "computed",
  computed_type: "number",
  display_name: "Area",
};
const computedTextField: FieldDef = {
  field_key: "label",
  field_type: "computed",
  display_name: "Label",
};
const attachmentField: FieldDef = {
  field_key: "files",
  field_type: "attachment",
  display_name: "Files",
};

describe("aggregation registry", () => {
  test("getAggregationKinds maps field type to catalogue", () => {
    expect(getAggregationKinds(textField)).toBe(TEXT_AGGREGATIONS);
    expect(getAggregationKinds(numberField)).toBe(NUMBER_AGGREGATIONS);
    expect(getAggregationKinds(singleSelectField)).toBe(SINGLE_SELECT_AGGREGATIONS);
    expect(getAggregationKinds(computedNumberField)).toBe(NUMBER_AGGREGATIONS);
    expect(getAggregationKinds(computedTextField)).toBe(TEXT_AGGREGATIONS);
    expect(getAggregationKinds(attachmentField)).toEqual([]);
    expect(getAggregationKinds(undefined)).toEqual([]);
  });

  test("text catalogue exposes only count", () => {
    expect(getAggregationKinds(textField).map((d) => d.kind)).toEqual(["count"]);
  });

  test("number catalogue exposes count + sum + mean + min + max", () => {
    expect(getAggregationKinds(numberField).map((d) => d.kind)).toEqual([
      "count",
      "sum",
      "mean",
      "min",
      "max",
    ]);
  });
});

describe("formatAggregation", () => {
  test("none always renders empty", () => {
    expect(formatAggregation("none", [1, 2, 3])).toBe("");
  });

  test("count skips null / undefined / empty string but counts 0", () => {
    expect(formatAggregation("count", [null, undefined, "", 0, "x"])).toBe("2");
  });

  test("count returns 0 for an empty list", () => {
    expect(formatAggregation("count", [])).toBe("0");
  });

  test("sum / mean / min / max parse string numbers and ignore NaN", () => {
    const values = [1, "2", "not-a-number", null, 3];
    expect(formatAggregation("sum", values)).toBe("6.00");
    expect(formatAggregation("mean", values)).toBe("2.00");
    expect(formatAggregation("min", values)).toBe("1.00");
    expect(formatAggregation("max", values)).toBe("3.00");
  });

  test("stat kinds return — for an empty numeric collection", () => {
    expect(formatAggregation("sum", [null, "", "abc"])).toBe("—");
    expect(formatAggregation("mean", [])).toBe("—");
    expect(formatAggregation("min", [])).toBe("—");
    expect(formatAggregation("max", [])).toBe("—");
  });

  test("numbers format to two decimals", () => {
    expect(formatAggregation("mean", [1, 2])).toBe("1.50");
    expect(formatAggregation("sum", [0.1, 0.2])).toMatch(/^0\.30/);
  });
});
