import { describe, expect, it } from "vitest";
import { convertDisplayValueToMm, formatValueForDisplay } from "../displayUnitConverter";
import { parseToMm } from "../parseInput";
import type { DisplayFormat } from "../types";

describe("formatValueForDisplay", () => {
  it("mm 1 decimal", () => expect(formatValueForDisplay(1234.5, "mm")).toBe("1234.5"));
  it("mm custom decimals", () =>
    expect(formatValueForDisplay(1234.5678, "mm", 3)).toBe("1234.568"));
  it("cm 2 decimals", () => expect(formatValueForDisplay(1234, "cm")).toBe("123.40"));
  it("m 4 decimals", () => expect(formatValueForDisplay(1234, "m")).toBe("1.2340"));
  it("in 2 decimals", () => expect(formatValueForDisplay(25.4, "in")).toBe("1.00"));
  it("ft 3 decimals", () => expect(formatValueForDisplay(304.8, "ft")).toBe("1.000"));
  it("ft-in architectural", () => expect(formatValueForDisplay(762, "ft-in")).toBe("2' 6\""));
  it("in-frac fractional inches", () =>
    expect(formatValueForDisplay(306.3875, "in-frac")).toBe('12-1/16"'));
});

describe("convertDisplayValueToMm", () => {
  it("mm passthrough", () => expect(convertDisplayValueToMm(500, "mm")).toBe(500));
  it("cm → mm", () => expect(convertDisplayValueToMm(10, "cm")).toBe(100));
  it("m → mm", () => expect(convertDisplayValueToMm(1.5, "m")).toBe(1500));
  it("in → mm", () => expect(convertDisplayValueToMm(1, "in")).toBeCloseTo(25.4));
  it("ft → mm", () => expect(convertDisplayValueToMm(1, "ft")).toBeCloseTo(304.8));
});

describe("round-trip mm → display → parseToMm", () => {
  const cases: Array<{ format: DisplayFormat; mm: number; system: "si" | "ip" }> = [
    { format: "mm", mm: 1234, system: "si" },
    { format: "cm", mm: 1234, system: "si" },
    { format: "m", mm: 1234, system: "si" },
    { format: "in", mm: 1234, system: "ip" },
    { format: "ft", mm: 1234, system: "ip" },
    { format: "ft-in", mm: 762, system: "ip" },
    { format: "in-frac", mm: 306.3875, system: "ip" },
  ];
  for (const { format, mm, system } of cases) {
    it(`${format} round-trips`, () => {
      const display = formatValueForDisplay(mm, format);
      const parsed = parseToMm(display, system, format);
      expect(parsed).not.toBeNull();
      expect(Math.abs(parsed! - mm)).toBeLessThan(0.5);
    });
  }
});
