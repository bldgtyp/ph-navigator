import { describe, expect, test } from "vitest";
import {
  shadingFactorColor,
  VIEWER_SHADING_FACTOR_COLOR_STOPS,
  VIEWER_SHADING_FACTOR_MISSING_COLOR,
} from "../lib/shadingFactorColors";

describe("shading factor color scale", () => {
  test("pins the five physical-domain stops", () => {
    expect(VIEWER_SHADING_FACTOR_COLOR_STOPS.map(({ value, color }) => [value, color])).toEqual([
      [0, "#00224E"],
      [0.25, "#3B496C"],
      [0.5, "#7D7C78"],
      [0.75, "#B9B862"],
      [1, "#FDE737"],
    ]);
    for (const stop of VIEWER_SHADING_FACTOR_COLOR_STOPS) {
      expect(shadingFactorColor(stop.value)).toBe(stop.color);
    }
  });

  test("interpolates linearly between adjacent stops in sRGB", () => {
    expect(shadingFactorColor(0.125)).toBe("#1E365D");
    expect(shadingFactorColor(0.625)).toBe("#9B9A6D");
  });

  test("uses the Missing bucket for null and invalid values", () => {
    for (const value of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -0.01, 1.01]) {
      expect(shadingFactorColor(value)).toBe(VIEWER_SHADING_FACTOR_MISSING_COLOR);
    }
  });

  test("is deterministic across repeated calls", () => {
    expect(Array.from({ length: 10 }, () => shadingFactorColor(0.431))).toEqual(
      Array.from({ length: 10 }, () => "#6B6E75"),
    );
  });
});
