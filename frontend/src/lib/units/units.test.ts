import { describe, expect, test } from "vitest";
import {
  btuHft2FToWm2K,
  cfmFt2ToLSM2,
  cToF,
  formatAirPermeanceFromLSM2,
  formatConductivityFromWmK,
  formatDensityFromKgM3,
  formatLengthFromMm,
  formatUValueFromWm2K,
  formatVaporMu,
  formatVaporSd,
  hft2FBtuToM2kW,
  inToMm,
  jKgKToBtuLbF,
  kgM3ToLbFt3,
  m2ToFt2,
  m3hToCfm,
  m3ToFt3,
  m2kWToHft2FBtu,
  mmToIn,
  lSM2ToCfmFt2,
  parseAirPermeanceToLSM2,
  parseVaporMu,
  parseVaporSd,
  NUMBER_UNIT_TYPES,
  convertNumberUnitsToDisplay,
  convertNumberUnitsToSi,
  formatNumberUnitsDisplay,
  isCompatibleNumberUnitPair,
  isNumberUnitsConfig,
  numberUnitRegistrySnapshot,
  numberUnitsForType,
  parseNumberUnitsInput,
  parseLengthToMm,
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

  test("formats large unit values with thousands separators", () => {
    expect(formatLengthFromMm(16252.7, { unitSystem: "SI" })).toBe("16,252.7 mm");
    expect(formatLengthFromMm(50800, { unitSystem: "IP" })).toBe("2,000 in");
  });

  test("can omit thousands separators for editable unit inputs", () => {
    expect(formatLengthFromMm(16252.7, { unitSystem: "SI", showUnit: false })).toBe("16,252.7");
    expect(
      formatLengthFromMm(16252.7, {
        unitSystem: "SI",
        showUnit: false,
        useGrouping: false,
      }),
    ).toBe("16252.7");
  });

  test("parses explicit length units and fractional inches", () => {
    expect(parseLengthToMm("4 in", { unitSystem: "SI" })).toEqual({
      ok: true,
      valueSi: 101.6,
    });
    expect(parseLengthToMm("156 mm", { unitSystem: "IP" })).toEqual({
      ok: true,
      valueSi: 156,
    });
    expect(parseLengthToMm("6.5 cm", { unitSystem: "IP" })).toEqual({
      ok: true,
      valueSi: 65,
    });
    const fractional = parseLengthToMm('2-1/2"', { unitSystem: "IP" });
    expect(fractional.ok ? fractional.valueSi : null).toBeCloseTo(63.5, 10);
    expect(parseLengthToMm("4 yd", { unitSystem: "SI" })).toEqual({
      ok: false,
      code: "unsupported_unit",
      message: "Unsupported length unit.",
    });
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

  // The ASTM E2178 air-barrier material criterion is published in both
  // systems, so the pair doubles as a check on the conversion factor.
  test("converts the air-barrier material criterion between systems", () => {
    expect(lSM2ToCfmFt2(0.02)).toBeCloseTo(0.0039, 4);
    expect(cfmFt2ToLSM2(0.0039)).toBeCloseTo(0.02, 3);
  });

  test("formats air permeance by active unit system", () => {
    expect(formatAirPermeanceFromLSM2(0.02, { unitSystem: "SI" })).toBe("0.02 L/(s-m2) @ 75Pa");
    expect(formatAirPermeanceFromLSM2(0.02, { unitSystem: "IP" })).toBe("0.0039 cfm/ft2 @ 1.57psf");
  });

  test("parses air permeance back to SI", () => {
    expect(parseAirPermeanceToLSM2("0.02", { unitSystem: "SI" })).toEqual({
      ok: true,
      valueSi: 0.02,
    });
    const ip = parseAirPermeanceToLSM2("0.0039", { unitSystem: "IP" });
    expect(ip.ok).toBe(true);
    if (ip.ok) expect(ip.valueSi).toBeCloseTo(0.02, 3);
    expect(parseAirPermeanceToLSM2("-1", { unitSystem: "SI" })).toMatchObject({
      ok: false,
      code: "negative",
    });
  });

  test("converts vapor resistance and equivalent air layer between SI and IP", () => {
    expect(formatVaporMu(137.6, { unitSystem: "IP" })).toBe("1 perm-in");
    expect(formatVaporSd(50, { unitSystem: "IP" })).toBe("0.07 perm");
    expect(formatVaporSd(0, { unitSystem: "IP" })).toBe("∞ perm");
    expect(formatVaporSd(0, { unitSystem: "IP", showUnit: false })).toBe("∞");

    const mu = parseVaporMu("1", { unitSystem: "IP" });
    expect(mu.ok).toBe(true);
    if (mu.ok) expect(mu.valueSi).toBeCloseTo(137.6, 10);

    const sixMilPoly = parseVaporSd("0.07", { unitSystem: "IP" });
    expect(sixMilPoly.ok).toBe(true);
    if (sixMilPoly.ok) expect(sixMilPoly.valueSi).toBeCloseTo(50, 0);
    expect(parseVaporSd("∞", { unitSystem: "IP" })).toEqual({ ok: true, valueSi: 0 });

    expect(parseVaporMu("0.5", { unitSystem: "SI" })).toMatchObject({
      ok: false,
      code: "out_of_range",
    });
    expect(parseVaporSd("-1", { unitSystem: "SI" })).toMatchObject({
      ok: false,
      code: "negative",
    });
  });
});

describe("number unit registry", () => {
  test("exposes the MVP unit pairs", () => {
    expect(NUMBER_UNIT_TYPES.map((entry) => entry.id)).toEqual([
      "density",
      "conductivity",
      "u_value",
      "thermal_resistance",
      "specific_heat",
      "length",
      "length_mm",
      "area",
      "volume",
      "volume_liters",
      "flow_rate",
      "temperature",
      "pressure",
      "percentage",
      "surface_mass",
      "surface_mass_flux",
      "airflow",
      "electric_efficiency",
      "heat_loss_rate",
      "energy",
      "power",
      "air_permeance",
      "vapor_diffusion_resistance",
      "vapor_sd",
    ]);
    expect(isCompatibleNumberUnitPair("area", "m2", "ft2")).toBe(true);
    expect(isCompatibleNumberUnitPair("area", "m3", "ft3")).toBe(false);
    expect(numberUnitRegistrySnapshot()).toEqual({
      density: { si: ["kg_m3"], ip: ["lb_ft3"] },
      conductivity: { si: ["w_m_k"], ip: ["btu_h_ft_f"] },
      u_value: { si: ["w_m2_k"], ip: ["btu_h_ft2_f"] },
      thermal_resistance: { si: ["m2_k_w"], ip: ["h_ft2_f_btu"] },
      specific_heat: { si: ["j_kg_k"], ip: ["btu_lb_f"] },
      length: { si: ["m"], ip: ["ft"] },
      length_mm: { si: ["mm"], ip: ["in"] },
      area: { si: ["m2"], ip: ["ft2"] },
      volume: { si: ["m3"], ip: ["ft3"] },
      volume_liters: { si: ["l"], ip: ["gal"] },
      flow_rate: { si: ["l_min"], ip: ["gpm"] },
      temperature: { si: ["c"], ip: ["f"] },
      pressure: { si: ["pa"], ip: ["pa"] },
      percentage: { si: ["percent"], ip: ["percent"] },
      surface_mass: { si: ["g_m2"], ip: ["gr_ft2"] },
      surface_mass_flux: { si: ["kg_m2_s"], ip: ["gr_ft2_s"] },
      airflow: { si: ["m3_h"], ip: ["cfm"] },
      electric_efficiency: { si: ["wh_m3"], ip: ["w_cfm"] },
      heat_loss_rate: { si: ["w_k"], ip: ["btu_h_f"] },
      energy: { si: ["kwh"], ip: ["kbtu"] },
      power: { si: ["kw"], ip: ["kbtu_h"] },
      air_permeance: { si: ["l_s_m2_75pa"], ip: ["cfm_ft2_75pa"] },
      vapor_diffusion_resistance: { si: ["mu"], ip: ["perm_in"] },
      vapor_sd: { si: ["sd_m"], ip: ["perm"] },
    });
  });

  test("validates complete number unit config", () => {
    expect(
      isNumberUnitsConfig({
        mode: "fixed",
        unit_type: "density",
        si_unit: "kg_m3",
        ip_unit: "lb_ft3",
        precision_si: 1,
        precision_ip: 1,
      }),
    ).toBe(true);
    expect(
      isNumberUnitsConfig({
        mode: "fixed",
        unit_type: "density",
        si_unit: "m",
        ip_unit: "ft",
        precision_si: 1,
        precision_ip: 1,
      }),
    ).toBe(false);
    expect(
      isNumberUnitsConfig({
        mode: "fixed",
        unit_type: "density",
        si_unit: "kg_m3",
        ip_unit: "lb_ft3",
        precision_si: 11,
        precision_ip: 1,
      }),
    ).toBe(false);
  });

  test("builds a canonical fixed config from a unit type", () => {
    expect(
      numberUnitsForType("thermal_resistance", {
        mode: "fixed",
        precision_si: 2,
        precision_ip: 2,
      }),
    ).toEqual({
      mode: "fixed",
      unit_type: "thermal_resistance",
      si_unit: "m2_k_w",
      ip_unit: "h_ft2_f_btu",
      precision_si: 2,
      precision_ip: 2,
    });
  });

  test("converts MVP number unit pairs", () => {
    const density = {
      mode: "editable" as const,
      unit_type: "density" as const,
      si_unit: "kg_m3" as const,
      ip_unit: "lb_ft3" as const,
      precision_si: 1,
      precision_ip: 1,
    };
    expect(convertNumberUnitsToDisplay(100, density)).toBeCloseTo(6.242796, 6);
    expect(convertNumberUnitsToSi(6.242796, density)).toBeCloseTo(100, 6);

    const length = {
      mode: "editable" as const,
      unit_type: "length" as const,
      si_unit: "m" as const,
      ip_unit: "ft" as const,
      precision_si: 2,
      precision_ip: 2,
    };
    expect(convertNumberUnitsToDisplay(1, length)).toBeCloseTo(3.280839895, 9);
    expect(convertNumberUnitsToSi(3.280839895, length)).toBeCloseTo(1, 9);

    const gallonsLiters = {
      mode: "fixed" as const,
      unit_type: "volume_liters" as const,
      si_unit: "l" as const,
      ip_unit: "gal" as const,
      precision_si: 1,
      precision_ip: 1,
    };
    expect(convertNumberUnitsToDisplay(3.785411784, gallonsLiters)).toBeCloseTo(1, 10);
    expect(convertNumberUnitsToSi(1, gallonsLiters)).toBeCloseTo(3.785411784, 10);

    const flowRate = {
      mode: "fixed" as const,
      unit_type: "flow_rate" as const,
      si_unit: "l_min" as const,
      ip_unit: "gpm" as const,
      precision_si: 1,
      precision_ip: 1,
    };
    expect(convertNumberUnitsToDisplay(3.785411784, flowRate)).toBeCloseTo(1, 10);
    expect(convertNumberUnitsToSi(1, flowRate)).toBeCloseTo(3.785411784, 10);

    const energy = {
      mode: "fixed" as const,
      unit_type: "energy" as const,
      si_unit: "kwh" as const,
      ip_unit: "kbtu" as const,
      precision_si: 0,
      precision_ip: 0,
    };
    expect(convertNumberUnitsToDisplay(1, energy)).toBeCloseTo(3.412141633, 10);
    expect(convertNumberUnitsToSi(3.412141633, energy)).toBeCloseTo(1, 10);

    const temperature = {
      mode: "fixed" as const,
      unit_type: "temperature" as const,
      si_unit: "c" as const,
      ip_unit: "f" as const,
      precision_si: 1,
      precision_ip: 1,
    };
    expect(convertNumberUnitsToDisplay(0, temperature)).toBe(32);
    expect(convertNumberUnitsToSi(212, temperature)).toBe(100);

    const thermalResistance = {
      mode: "fixed" as const,
      unit_type: "thermal_resistance" as const,
      si_unit: "m2_k_w" as const,
      ip_unit: "h_ft2_f_btu" as const,
      precision_si: 2,
      precision_ip: 2,
    };
    expect(convertNumberUnitsToDisplay(1, thermalResistance)).toBeCloseTo(5.678263337, 9);
    expect(convertNumberUnitsToSi(5.678263337, thermalResistance)).toBeCloseTo(1, 9);

    const surfaceMass = {
      mode: "fixed" as const,
      unit_type: "surface_mass" as const,
      si_unit: "g_m2" as const,
      ip_unit: "gr_ft2" as const,
      precision_si: 1,
      precision_ip: 1,
    };
    expect(convertNumberUnitsToDisplay(1, surfaceMass)).toBeCloseTo(1.433076, 6);
    expect(convertNumberUnitsToSi(1.433076, surfaceMass)).toBeCloseTo(1, 6);

    const surfaceMassFlux = {
      mode: "fixed" as const,
      unit_type: "surface_mass_flux" as const,
      si_unit: "kg_m2_s" as const,
      ip_unit: "gr_ft2_s" as const,
      precision_si: 10,
      precision_ip: 7,
    };
    expect(convertNumberUnitsToDisplay(1, surfaceMassFlux)).toBeCloseTo(1433.076, 3);
    expect(convertNumberUnitsToSi(1433.076, surfaceMassFlux)).toBeCloseTo(1, 6);
  });

  test("formatNumberUnitsDisplay renders bare numbers in active system", () => {
    const density = {
      mode: "editable" as const,
      unit_type: "density" as const,
      si_unit: "kg_m3" as const,
      ip_unit: "lb_ft3" as const,
      precision_si: 1,
      precision_ip: 2,
    };
    expect(formatNumberUnitsDisplay(100, density, "SI")).toBe("100.0");
    expect(formatNumberUnitsDisplay(100, density, "IP")).toBe("6.24");
    expect(formatNumberUnitsDisplay(null, density, "SI")).toBe("");
    expect(formatNumberUnitsDisplay("", density, "IP")).toBe("");
    expect(formatNumberUnitsDisplay("abc", density, "SI")).toBe("");
  });

  test("parseNumberUnitsInput returns SI canonical or undefined / null", () => {
    const length = {
      mode: "editable" as const,
      unit_type: "length" as const,
      si_unit: "m" as const,
      ip_unit: "ft" as const,
      precision_si: 2,
      precision_ip: 2,
    };
    // IP input -> SI canonical (1 ft ≈ 0.3048 m)
    expect(parseNumberUnitsInput("1", length, "IP")).toBeCloseTo(0.3048, 6);
    // SI input passes through unchanged
    expect(parseNumberUnitsInput("1", length, "SI")).toBe(1);
    // Blank parses to null (clear cell)
    expect(parseNumberUnitsInput("   ", length, "IP")).toBe(null);
    // Garbage parses to undefined so callers can surface "expected a number"
    expect(parseNumberUnitsInput("abc", length, "SI")).toBe(undefined);
  });

  test("zero vapor sd remains editable as infinite IP permeance", () => {
    const vaporSd = {
      mode: "fixed" as const,
      unit_type: "vapor_sd" as const,
      si_unit: "sd_m" as const,
      ip_unit: "perm" as const,
      precision_si: 2,
      precision_ip: 3,
    };
    expect(formatNumberUnitsDisplay(0, vaporSd, "IP")).toBe("∞");
    expect(parseNumberUnitsInput("∞", vaporSd, "IP")).toBe(0);
  });
});
