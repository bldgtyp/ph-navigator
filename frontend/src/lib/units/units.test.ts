import { describe, expect, test } from "vitest";
import {
  btuHft2FToWm2K,
  cToF,
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatLengthFromMm,
  formatUValueFromWm2K,
  hft2FBtuToM2kW,
  inToMm,
  jKgKToBtuLbF,
  kgM3ToLbFt3,
  m2ToFt2,
  m3hToCfm,
  m3ToFt3,
  m2kWToHft2FBtu,
  mmToIn,
  wm2kToBtuHft2F,
  wmkToBtuHftF,
} from ".";

describe("unit conversion fixtures", () => {
  test("length fixtures", () => {
    expect(mmToIn(25.4)).toBeCloseTo(1, 10);
    expect(inToMm(1)).toBeCloseTo(25.4, 10);
    expect(mmToIn(304.8)).toBeCloseTo(12, 10);
  });

  test("area and volume fixtures", () => {
    expect(m2ToFt2(1)).toBeCloseTo(10.7639104167, 10);
    expect(m3ToFt3(1)).toBeCloseTo(35.3146667215, 10);
  });

  test("thermal transmittance and resistance fixtures", () => {
    expect(wm2kToBtuHft2F(1)).toBeCloseTo(0.1761101838, 10);
    expect(btuHft2FToWm2K(0.1761101838)).toBeCloseTo(1, 10);
    expect(m2kWToHft2FBtu(1)).toBeCloseTo(5.678263337, 10);
    expect(hft2FBtuToM2kW(5.678263337)).toBeCloseTo(1, 10);
    expect(wmkToBtuHftF(1)).toBeCloseTo(0.577789317, 10);
  });

  test("material and airflow fixtures", () => {
    expect(kgM3ToLbFt3(1)).toBeCloseTo(0.06242796, 10);
    expect(jKgKToBtuLbF(1)).toBeCloseTo(0.0002388458966275, 14);
    expect(m3hToCfm(1)).toBeCloseTo(0.588577779, 10);
  });

  test("temperature fixture uses offset conversion", () => {
    expect(cToF(0)).toBe(32);
  });
});

describe("unit display helpers", () => {
  test("formats length by active unit system", () => {
    expect(formatLengthFromMm(25.4, { unitSystem: "SI" })).toBe("25.4 mm");
    expect(formatLengthFromMm(25.4, { unitSystem: "IP" })).toBe("1 in");
  });

  test("formats thermal values by active unit system", () => {
    expect(formatUValueFromWm2K(1, { unitSystem: "SI" })).toBe("1 W/(m2-K)");
    expect(formatUValueFromWm2K(1, { unitSystem: "IP" })).toBe("0.176 Btu/(h-ft2-F)");
    expect(formatConductivityFromWmK(1, { unitSystem: "IP" })).toBe("0.578 Btu/(h-ft-F)");
  });

  test("formats density by active unit system", () => {
    expect(formatDensityFromKgM3(100, { unitSystem: "SI" })).toBe("100 kg/m3");
    expect(formatDensityFromKgM3(100, { unitSystem: "IP" })).toBe("6.2 lb/ft3");
  });
});
