import { describe, expect, test } from "vitest";
import {
  cmykToHex,
  colorToCss,
  hexToRgb,
  normalizeColorInput,
  normalizeHexColor,
  normalizeStoredHexColor,
  rgbToCmyk,
  rgbToHex,
} from "./color";

describe("normalizeHexColor", () => {
  test("normalizes six-digit hex storage values", () => {
    expect(normalizeHexColor("#DCE6F0")).toBe("#dce6f0");
    expect(normalizeHexColor("  #AABBCC  ")).toBe("#aabbcc");
  });

  test("expands short hex only in the frontend input helper", () => {
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeHexColor("#abcd")).toBeNull();
    expect(normalizeHexColor("red")).toBeNull();
  });

  test("keeps stored hex validation strict", () => {
    expect(normalizeStoredHexColor("#AABBCC")).toBe("#aabbcc");
    expect(normalizeStoredHexColor("#abc")).toBeNull();
  });
});

describe("normalizeColorInput", () => {
  test("accepts rgb function syntax", () => {
    expect(normalizeColorInput("rgb(220, 230, 240)")).toBe("#dce6f0");
    expect(normalizeColorInput("rgb(220 230 240)")).toBe("#dce6f0");
  });

  test("accepts cmyk function syntax", () => {
    expect(normalizeColorInput("cmyk(100, 0, 0, 0)")).toBe("#00ffff");
    expect(normalizeColorInput("cmyk(100% 0% 0% 0%)")).toBe("#00ffff");
  });

  test("rejects out-of-range channels", () => {
    expect(normalizeColorInput("rgb(256, 0, 0)")).toBeNull();
    expect(normalizeColorInput("cmyk(0, 0, 0, 101)")).toBeNull();
  });
});

describe("RGB and CMYK conversion", () => {
  test("round-trips hex to rgb", () => {
    expect(hexToRgb("#dce6f0")).toEqual({ r: 220, g: 230, b: 240 });
    expect(rgbToHex({ r: 220, g: 230, b: 240 })).toBe("#dce6f0");
  });

  test("converts CMYK percentages to stored hex", () => {
    expect(cmykToHex({ c: 100, m: 0, y: 0, k: 0 })).toBe("#00ffff");
    expect(cmykToHex({ c: 0, m: 0, y: 0, k: 100 })).toBe("#000000");
  });

  test("converts RGB to CMYK percentages for UI fields", () => {
    expect(rgbToCmyk({ r: 0, g: 255, b: 255 })).toEqual({ c: 100, m: 0, y: 0, k: 0 });
  });
});

describe("colorToCss", () => {
  test("returns normalized CSS hex or fallback", () => {
    expect(colorToCss("#DCE6F0")).toBe("#dce6f0");
    expect(colorToCss("bad", "transparent")).toBe("transparent");
  });
});
