import { describe, expect, test } from "vitest";
import { coerceFieldValue } from "../lib/rows/defaults";

const colorField = { field_key: "finish", field_type: "color", display_name: "Finish" } as const;

describe("coerceFieldValue — color", () => {
  test("maps blank nullable color cells to null", () => {
    expect(coerceFieldValue("", colorField, () => [])).toEqual({ ok: true, value: null });
  });

  test("rejects blank required color cells", () => {
    expect(coerceFieldValue("", { ...colorField, required: true }, () => [])).toEqual({
      ok: false,
      message: "Value required.",
    });
  });

  test("normalizes color inputs to stored hex", () => {
    expect(coerceFieldValue("#ABC", colorField, () => [])).toEqual({
      ok: true,
      value: "#aabbcc",
    });
    expect(coerceFieldValue("rgb(220, 230, 240)", colorField, () => [])).toEqual({
      ok: true,
      value: "#dce6f0",
    });
    expect(coerceFieldValue("cmyk(8, 4, 0, 6)", colorField, () => [])).toEqual({
      ok: true,
      value: "#dde6f0",
    });
  });

  test("rejects invalid color inputs", () => {
    expect(coerceFieldValue("bad", colorField, () => [])).toEqual({
      ok: false,
      message: "Expected a hex, RGB, or CMYK color.",
    });
  });
});
