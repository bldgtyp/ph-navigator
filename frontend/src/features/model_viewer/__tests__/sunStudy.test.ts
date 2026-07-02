import { describe, expect, test } from "vitest";
import {
  altitudeDeg,
  azimuthDeg,
  dayOfYear,
  dayOfYearLabel,
  decimalHourLabel,
  interpolateSunVector,
  minutesLabel,
  SUN_STUDY_PRESETS,
  sunIntensityFactor,
  sunriseSunsetForDay,
  todayDayOfYear,
} from "../lib/sunStudy";
import type { SunPositionGridModelData } from "../types";

/** A tiny synthetic grid: two days, 24 hours, with easily-checked vectors. */
function syntheticGrid(): SunPositionGridModelData {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const days = [1, 2];
  const unit_vectors: [number, number, number][] = [];
  for (const day of days) {
    for (const hour of hours) {
      // Day 1: sun swings through the +X/+Z quadrant; day 2 mirrored to -X.
      const angle = ((hour - 6) / 12) * Math.PI; // -pi/2 at 0h .. 3pi/2
      const sign = day === 1 ? 1 : -1;
      unit_vectors.push([sign * Math.cos(angle), 0, Math.sin(angle)]);
    }
  }
  return {
    true_north_deg: 0,
    hours,
    days,
    unit_vectors,
    sunrise_sunset: [
      [6.0, 18.0],
      [7.25, 16.75],
    ],
  };
}

describe("sun-study grid interpolation", () => {
  test("whole hours return the grid vector exactly (no drift)", () => {
    const grid = syntheticGrid();
    for (const hour of [0, 6, 12, 23]) {
      const vector = interpolateSunVector(grid, 1, hour * 60);
      const expected = grid.unit_vectors[hour];
      expect(vector[0]).toBeCloseTo(expected![0], 12);
      expect(vector[1]).toBeCloseTo(expected![1], 12);
      expect(vector[2]).toBeCloseTo(expected![2], 12);
    }
  });

  test("half hours normalize-lerp between adjacent vectors", () => {
    const grid = syntheticGrid();
    const vector = interpolateSunVector(grid, 1, 12 * 60 + 30);
    // Between hour 12 (top) and 13: still unit length, tilted toward hour 13.
    expect(Math.hypot(...vector)).toBeCloseTo(1, 12);
    const at12 = interpolateSunVector(grid, 1, 12 * 60);
    const at13 = interpolateSunVector(grid, 1, 13 * 60);
    expect(vector[2]).toBeLessThan(at12[2]);
    expect(vector[2]).toBeGreaterThan(at13[2]);
  });

  test("the 23h tail holds the 23:00 vector (clamp, not wraparound)", () => {
    const grid = syntheticGrid();
    const at2359 = interpolateSunVector(grid, 1, 23 * 60 + 59);
    const at23 = interpolateSunVector(grid, 1, 23 * 60);
    expect(at2359).toEqual(at23);
  });

  test("day scrubbing snaps to grid rows (no day-axis interpolation)", () => {
    const grid = syntheticGrid();
    const day1 = interpolateSunVector(grid, 1, 9 * 60);
    const day2 = interpolateSunVector(grid, 2, 9 * 60);
    expect(day1[0]).toBeCloseTo(-day2[0], 12);
  });
});

describe("sun-study readout derivations", () => {
  test("altitude is asin(z) in degrees", () => {
    expect(altitudeDeg([0, 0, 1])).toBeCloseTo(90);
    expect(altitudeDeg([1, 0, 0])).toBeCloseTo(0);
    expect(altitudeDeg([0, 0, -0.5])).toBeCloseTo(-30);
  });

  test("azimuth is compass-clockwise from true north", () => {
    expect(azimuthDeg([0, 1, 0], 0)).toBeCloseTo(0); // +Y = N
    expect(azimuthDeg([1, 0, 0], 0)).toBeCloseTo(90); // +X = E
    expect(azimuthDeg([0, -1, 0], 0)).toBeCloseTo(180); // -Y = S
    expect(azimuthDeg([-1, 0, 0], 0)).toBeCloseTo(270); // -X = W
  });

  test("azimuth undoes the baked true-north rotation", () => {
    // With true north at 90 (stored convention: North tick on -X), a sun due
    // south sits at +X in the dome frame.
    expect(azimuthDeg([1, 0, 0], 90)).toBeCloseTo(180);
  });

  test("intensity ramp: zero at horizon, full above ~4 degrees, smooth between", () => {
    expect(sunIntensityFactor(-10)).toBe(0);
    expect(sunIntensityFactor(0)).toBe(0);
    expect(sunIntensityFactor(2)).toBeGreaterThan(0);
    expect(sunIntensityFactor(2)).toBeLessThan(1);
    expect(sunIntensityFactor(4)).toBe(1);
    expect(sunIntensityFactor(60)).toBe(1);
  });

  test("sunrise/sunset pairs come straight from the grid", () => {
    const grid = syntheticGrid();
    expect(sunriseSunsetForDay(grid, 1)).toEqual([6.0, 18.0]);
    expect(sunriseSunsetForDay(grid, 2)).toEqual([7.25, 16.75]);
  });
});

describe("sun-study calendar helpers", () => {
  test("day-of-year on the fixed non-leap calendar", () => {
    expect(dayOfYear(1, 1)).toBe(1);
    expect(dayOfYear(3, 20)).toBe(79);
    expect(dayOfYear(6, 21)).toBe(172);
    expect(dayOfYear(9, 22)).toBe(265);
    expect(dayOfYear(12, 21)).toBe(355);
    expect(dayOfYear(12, 31)).toBe(365);
  });

  test("labels round-trip", () => {
    expect(dayOfYearLabel(1)).toBe("Jan 1");
    expect(dayOfYearLabel(172)).toBe("Jun 21");
    expect(dayOfYearLabel(365)).toBe("Dec 31");
    expect(minutesLabel(14 * 60 + 30)).toBe("14:30");
    expect(minutesLabel(0)).toBe("00:00");
    expect(decimalHourLabel(5.4)).toBe("05:24");
  });

  test("preset chips are the PH review dates in calendar order", () => {
    expect(SUN_STUDY_PRESETS.map((p) => p.label)).toEqual(["Dec 21", "Mar 20", "Jun 21", "Sep 22"]);
    expect(SUN_STUDY_PRESETS.map((p) => p.day)).toEqual([355, 79, 172, 265]);
  });

  test("Feb 29 maps onto Feb 28 (365-day grid)", () => {
    expect(todayDayOfYear(new Date(2024, 1, 29))).toBe(dayOfYear(2, 28));
  });
});
