import { describe, expect, it } from "vitest";
import { evaluateSimpleExpression } from "../evaluateExpression";

describe("evaluateSimpleExpression", () => {
  describe("simple numbers", () => {
    it("integer", () => expect(evaluateSimpleExpression("100")).toBe(100));
    it("decimal", () => expect(evaluateSimpleExpression("12.5")).toBe(12.5));
    it("negative", () => expect(evaluateSimpleExpression("-50")).toBe(-50));
    it("leading zeros", () => expect(evaluateSimpleExpression("007")).toBe(7));
  });

  describe("basic arithmetic", () => {
    it("addition", () => expect(evaluateSimpleExpression("100 + 150")).toBe(250));
    it("subtraction", () => expect(evaluateSimpleExpression("200 - 50")).toBe(150));
    it("multiplication", () => expect(evaluateSimpleExpression("10 * 5")).toBe(50));
    it("division", () => expect(evaluateSimpleExpression("100 / 4")).toBe(25));
    it("decimal arithmetic", () => expect(evaluateSimpleExpression("10.5 + 2.5")).toBe(13));
  });

  describe("chained operations", () => {
    it("chained add", () => expect(evaluateSimpleExpression("1 + 2 + 3")).toBe(6));
    it("chained sub", () => expect(evaluateSimpleExpression("100 - 20 - 30")).toBe(50));
    it("chained mul", () => expect(evaluateSimpleExpression("2 * 3 * 4")).toBe(24));
    it("chained div", () => expect(evaluateSimpleExpression("100 / 2 / 5")).toBe(10));
    it("many", () => expect(evaluateSimpleExpression("1 + 2 + 3 + 4 + 5")).toBe(15));
  });

  describe("operator precedence", () => {
    it("mul before add", () => expect(evaluateSimpleExpression("2 + 3 * 4")).toBe(14));
    it("div before sub", () => expect(evaluateSimpleExpression("10 - 6 / 2")).toBe(7));
    it("mul before sub", () => expect(evaluateSimpleExpression("10 - 2 * 3")).toBe(4));
    it("div before add", () => expect(evaluateSimpleExpression("5 + 10 / 2")).toBe(10));
    it("mixed", () => expect(evaluateSimpleExpression("2 + 3 * 4 - 6 / 2")).toBe(11));
  });

  describe("whitespace", () => {
    it("no spaces", () => expect(evaluateSimpleExpression("100+50")).toBe(150));
    it("extra spaces", () => expect(evaluateSimpleExpression("  100   +   50  ")).toBe(150));
    it("mixed", () => expect(evaluateSimpleExpression("10+ 20 +30")).toBe(60));
  });

  describe("parens (new in V2)", () => {
    it("(1+2) * 3 = 9", () => expect(evaluateSimpleExpression("(1+2) * 3")).toBe(9));
    it("((1+2)*3) = 9", () => expect(evaluateSimpleExpression("((1+2)*3)")).toBe(9));
    it("(1200 - 50) / 4 = 287.5", () =>
      expect(evaluateSimpleExpression("(1200 - 50) / 4")).toBe(287.5));
    it("nested with precedence", () =>
      expect(evaluateSimpleExpression("2 * (3 + 4 * 2)")).toBe(22));
    it("mismatched paren → NaN", () => expect(evaluateSimpleExpression("(1 + 2")).toBeNaN());
    it("extra close paren → NaN", () => expect(evaluateSimpleExpression("1 + 2)")).toBeNaN());
  });

  describe("edge cases", () => {
    it("div by zero → NaN", () => expect(evaluateSimpleExpression("100 / 0")).toBeNaN());
    it("empty → NaN", () => expect(evaluateSimpleExpression("")).toBeNaN());
    it("whitespace → NaN", () => expect(evaluateSimpleExpression("   ")).toBeNaN());
    it("trailing op → NaN", () => expect(evaluateSimpleExpression("100 +")).toBeNaN());
    it("leading op → NaN", () => expect(evaluateSimpleExpression("+ 100")).toBeNaN());
    it("double ops → NaN", () => expect(evaluateSimpleExpression("100 + + 50")).toBeNaN());
  });

  describe("security — invalid input rejection", () => {
    it("alpha → NaN", () => expect(evaluateSimpleExpression("abc")).toBeNaN());
    it("alert(1) → NaN", () => expect(evaluateSimpleExpression("alert(1)")).toBeNaN());
    it("function(){} → NaN", () => expect(evaluateSimpleExpression("function(){}")).toBeNaN());
    it("eval → NaN", () => expect(evaluateSimpleExpression('eval("1+1")')).toBeNaN());
    it("var ref → NaN", () => expect(evaluateSimpleExpression("x + 1")).toBeNaN());
    it("special char → NaN", () => expect(evaluateSimpleExpression("100 $ 50")).toBeNaN());
    it("semicolons → NaN", () => expect(evaluateSimpleExpression("100; 50")).toBeNaN());
  });
});
