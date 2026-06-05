import { describe, expect, it } from "vitest";
import { parseInput, parseToMm } from "../parseInput";

describe("parseInput (legacy V1 shape)", () => {
  describe("SI mode", () => {
    it("plain number", () => expect(parseInput("24", false)).toBe(24));
    it("expression", () => expect(parseInput("24 + 12", false)).toBe(36));
    it("ignores ft-in markers (returns NaN)", () => expect(parseInput("2' 6\"", false)).toBeNaN());
    it("invalid → NaN", () => expect(parseInput("abc", false)).toBeNaN());
  });
  describe("IP mode", () => {
    it("2' → 24", () => expect(parseInput("2'", true)).toBe(24));
    it('6" → 6', () => expect(parseInput('6"', true)).toBe(6));
    it("2' 6\" → 30", () => expect(parseInput("2' 6\"", true)).toBe(30));
    it('6-1/2" → 6.5', () => expect(parseInput('6-1/2"', true)).toBe(6.5));
    it("plain expression fallback", () => expect(parseInput("24 + 12", true)).toBe(36));
    it("empty → NaN", () => expect(parseInput("", true)).toBeNaN());
  });
  describe("disambiguation", () => {
    it('6-1/2" is ft-in (6.5)', () => expect(parseInput('6-1/2"', true)).toBe(6.5));
    it("6-1/2 (no marker) is arithmetic (5.5)", () => expect(parseInput("6-1/2", true)).toBe(5.5));
  });
});

describe("parseToMm", () => {
  describe("SI mode", () => {
    it("mm bare → same value", () => expect(parseToMm("1200", "si", "mm")).toBe(1200));
    it("cm → mm", () => expect(parseToMm("150", "si", "cm")).toBe(1500));
    it("m → mm", () => expect(parseToMm("1.2", "si", "m")).toBeCloseTo(1200));
    it("expression", () => expect(parseToMm("1200 / 4", "si", "mm")).toBe(300));
    it("parens expression", () => expect(parseToMm("(1200 - 50) / 4", "si", "mm")).toBe(287.5));
    it("ft-in marker rejected", () => expect(parseToMm("2' 6\"", "si", "mm")).toBeNull());
    it("empty → null", () => expect(parseToMm("", "si", "mm")).toBeNull());
    it("zero → null", () => expect(parseToMm("0", "si", "mm")).toBeNull());
    it("negative → null", () => expect(parseToMm("-100", "si", "mm")).toBeNull());
  });

  describe("IP mode", () => {
    it("2' 6\" → 762 mm", () => expect(parseToMm("2' 6\"", "ip", "ft-in")!).toBeCloseTo(762));
    it('6-1/2" → 165.1 mm', () => expect(parseToMm('6-1/2"', "ip", "in-frac")!).toBeCloseTo(165.1));
    it("bare number in ft mode → mm via ft factor", () =>
      expect(parseToMm("1", "ip", "ft")!).toBeCloseTo(304.8));
    it("bare number in in mode → mm via in factor", () =>
      expect(parseToMm("12", "ip", "in")!).toBeCloseTo(304.8));
    it("expression in ft mode", () => expect(parseToMm("1 + 0.5", "ip", "ft")!).toBeCloseTo(457.2));
    it("malformed → null", () => expect(parseToMm("abc", "ip", "in")).toBeNull());
  });
});
