import { describe, expect, it } from "vitest";
import { formatFeetInches } from "../formatFeetInches";

describe("formatFeetInches (ft-in)", () => {
  it("zero", () => expect(formatFeetInches(0)).toBe('0"'));
  it("exact feet", () => {
    expect(formatFeetInches(304.8)).toBe("1'");
    expect(formatFeetInches(609.6)).toBe("2'");
    expect(formatFeetInches(914.4)).toBe("3'");
  });
  it("exact inches", () => {
    expect(formatFeetInches(25.4)).toBe('1"');
    expect(formatFeetInches(152.4)).toBe('6"');
  });
  it("feet + inches", () => {
    expect(formatFeetInches(762.0)).toBe("2' 6\"");
    expect(formatFeetInches(1016.0)).toBe("3' 4\"");
  });
  it("inches with fractions", () => expect(formatFeetInches(165.1)).toBe('6-1/2"'));
  it("feet + inches + fractions", () => expect(formatFeetInches(774.7)).toBe("2' 6-1/2\""));
  it("pure fractions", () => {
    expect(formatFeetInches(12.7)).toBe('1/2"');
    expect(formatFeetInches(19.05)).toBe('3/4"');
  });
  it("reduces to lowest terms", () => {
    expect(formatFeetInches(6.35)).toBe('1/4"');
    expect(formatFeetInches(12.7)).toBe('1/2"');
  });
  it("negative", () => expect(formatFeetInches(-304.8)).toBe("-1'"));
  it('snaps to nearest 1/16"', () => expect(formatFeetInches(1.5875)).toBe('1/16"'));
});

describe("formatFeetInches (in-frac)", () => {
  it('306.3875 mm → 12-1/16"', () =>
    expect(formatFeetInches(306.3875, "in-frac")).toBe('12-1/16"'));
  it('0 mm → 0"', () => expect(formatFeetInches(0, "in-frac")).toBe('0"'));
  it('12.7 mm → 1/2"', () => expect(formatFeetInches(12.7, "in-frac")).toBe('1/2"'));
  it('25.4 mm → 1"', () => expect(formatFeetInches(25.4, "in-frac")).toBe('1"'));
  it("negative", () => expect(formatFeetInches(-25.4, "in-frac")).toBe('-1"'));
});
