import { describe, expect, it } from "vitest";
import { locationForSide, operationForElement } from "../picker-filters";

describe("locationForSide", () => {
  it("maps top → head, bottom → sill, sides → jamb", () => {
    expect(locationForSide("top")).toBe("head");
    expect(locationForSide("bottom")).toBe("sill");
    expect(locationForSide("left")).toBe("jamb");
    expect(locationForSide("right")).toBe("jamb");
  });
});

describe("operationForElement", () => {
  it("returns Fixed for null operation", () => {
    expect(operationForElement(null)).toEqual({ type: "Fixed", directions: [] });
  });

  it("capitalises directions and maps swing→Swing / slide→Slide", () => {
    expect(operationForElement({ type: "swing", directions: ["left", "up"] })).toEqual({
      type: "Swing",
      directions: ["Left", "Up"],
    });
    expect(operationForElement({ type: "slide", directions: ["right"] })).toEqual({
      type: "Slide",
      directions: ["Right"],
    });
  });
});
