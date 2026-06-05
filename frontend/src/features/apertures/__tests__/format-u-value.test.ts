import { describe, expect, it } from "vitest";
import { W_M2K_TO_BTU_HRFT2F, formatElementUValue, formatWindowUValue } from "../format-u-value";

describe("formatWindowUValue", () => {
  it("renders SI to two decimal places with the canonical label", () => {
    expect(formatWindowUValue(1.2, "si")).toBe("Window U-Value: 1.20 W/m²K");
  });

  it("converts SI → IP using the standard factor", () => {
    const ip = 1.2 * W_M2K_TO_BTU_HRFT2F;
    expect(formatWindowUValue(1.2, "ip")).toBe(`Window U-Value: ${ip.toFixed(2)} BTU/(hr·ft²·°F)`);
  });

  it("renders -- for null / undefined / NaN", () => {
    expect(formatWindowUValue(null, "si")).toBe("Window U-Value: --");
    expect(formatWindowUValue(undefined, "si")).toBe("Window U-Value: --");
    expect(formatWindowUValue(Number.NaN, "ip")).toBe("Window U-Value: --");
  });
});

describe("formatElementUValue", () => {
  it("uses the compact label", () => {
    expect(formatElementUValue(0.9, "si")).toBe("U-Value: 0.90 W/m²K");
  });

  it("handles missing values", () => {
    expect(formatElementUValue(null, "ip")).toBe("U-Value: --");
  });
});
