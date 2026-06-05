import { describe, expect, it } from "vitest";
import { containsFeetInchesNotation, parseFeetInches } from "../parseFeetInches";

describe("containsFeetInchesNotation", () => {
  it("returns true for feet marker", () => {
    expect(containsFeetInchesNotation("2'")).toBe(true);
  });
  it("returns true for inch marker", () => {
    expect(containsFeetInchesNotation('6"')).toBe(true);
  });
  it("returns true for both markers", () => {
    expect(containsFeetInchesNotation("2' 6\"")).toBe(true);
  });
  it("returns false for plain number", () => {
    expect(containsFeetInchesNotation("24")).toBe(false);
  });
  it("returns false for arithmetic expression", () => {
    expect(containsFeetInchesNotation("24 + 12")).toBe(false);
  });
  it("handles curly quotes", () => {
    expect(containsFeetInchesNotation("2’")).toBe(true);
    expect(containsFeetInchesNotation("6”")).toBe(true);
  });
});

describe("parseFeetInches", () => {
  describe("feet only", () => {
    it("parses 2' as 24 inches", () => expect(parseFeetInches("2'")).toBe(24));
    it("parses 3' as 36 inches", () => expect(parseFeetInches("3'")).toBe(36));
    it("parses 0' as 0 inches", () => expect(parseFeetInches("0'")).toBe(0));
  });

  describe("inches only", () => {
    it('parses 6"', () => expect(parseFeetInches('6"')).toBe(6));
    it('parses 12"', () => expect(parseFeetInches('12"')).toBe(12));
    it('parses 6.5"', () => expect(parseFeetInches('6.5"')).toBe(6.5));
  });

  describe("feet and inches combined", () => {
    it("parses 2' 6\"", () => expect(parseFeetInches("2' 6\"")).toBe(30));
    it("parses 2'6\"", () => expect(parseFeetInches("2'6\"")).toBe(30));
    it("parses 3'-4\"", () => expect(parseFeetInches("3'-4\"")).toBe(40));
    it("parses 1' 0\"", () => expect(parseFeetInches("1' 0\"")).toBe(12));
  });

  describe("fractions", () => {
    it('1/2"', () => expect(parseFeetInches('1/2"')).toBe(0.5));
    it('3/4"', () => expect(parseFeetInches('3/4"')).toBe(0.75));
    it('1/8"', () => expect(parseFeetInches('1/8"')).toBe(0.125));
    it('6-1/2"', () => expect(parseFeetInches('6-1/2"')).toBe(6.5));
    it('6 1/2" (space)', () => expect(parseFeetInches('6 1/2"')).toBe(6.5));
    it('24 3/8"', () => expect(parseFeetInches('24 3/8"')).toBe(24.375));
  });

  describe("complex formats", () => {
    it("2' 6-1/2\"", () => expect(parseFeetInches("2' 6-1/2\"")).toBe(30.5));
    it("2' 6.5\"", () => expect(parseFeetInches("2' 6.5\"")).toBe(30.5));
    it("1' 3/4\"", () => expect(parseFeetInches("1' 3/4\"")).toBe(12.75));
  });

  describe("whitespace", () => {
    it("trims", () => expect(parseFeetInches("  2' 6\"  ")).toBe(30));
    it("multiple spaces", () => expect(parseFeetInches("2'   6\"")).toBe(30));
  });

  describe("smart-quote normalization", () => {
    it("curly apostrophe", () => expect(parseFeetInches("2’")).toBe(24));
    it("curly double-quote", () => expect(parseFeetInches("6”")).toBe(6));
  });

  describe("non-feet-inches input", () => {
    it("plain number → null", () => expect(parseFeetInches("24")).toBe(null));
    it("expression → null", () => expect(parseFeetInches("24 + 12")).toBe(null));
    it("empty → null", () => expect(parseFeetInches("")).toBe(null));
  });
});
