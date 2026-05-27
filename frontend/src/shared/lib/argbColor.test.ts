import { describe, expect, test } from "vitest";
import { argbToCssRgb, parseArgb } from "./argbColor";

describe("parseArgb", () => {
  test("parses canonical ARGB tuples", () => {
    expect(parseArgb("(255,230,240,250)")).toEqual({ a: 255, r: 230, g: 240, b: 250 });
  });

  test("parses whitespace-tolerant ARGB tuples", () => {
    expect(parseArgb("(255, 230, 240, 250)")).toEqual({ a: 255, r: 230, g: 240, b: 250 });
  });

  test("returns null for missing input", () => {
    expect(parseArgb(null)).toBeNull();
    expect(parseArgb("")).toBeNull();
  });

  test("returns null for malformed input", () => {
    expect(parseArgb("255,230,240,250")).toBeNull();
    expect(parseArgb("(255,230,240)")).toBeNull();
    expect(parseArgb("(255,230,240,999)")).toBeNull();
  });
});

describe("argbToCssRgb", () => {
  test("returns CSS rgb channels without alpha", () => {
    expect(argbToCssRgb("(128, 10, 20, 30)")).toBe("rgb(10 20 30)");
  });

  test("returns fallback for malformed input", () => {
    expect(argbToCssRgb("bad", "transparent")).toBe("transparent");
  });
});
