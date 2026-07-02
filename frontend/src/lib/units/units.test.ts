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
  NUMBER_UNIT_TYPES,
  convertNumberUnitsToDisplay,
  convertNumberUnitsToSi,
  formatNumberUnitsDisplay,
  isCompatibleNumberUnitPair,
  isNumberUnitsConfig,
  numberUnitRegistrySnapshot,
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
});

describe("number unit registry", () => {
  test("exposes the MVP unit pairs", () => {
    expect(NUMBER_UNIT_TYPES.map((entry) => entry.id)).toEqual([
      "density",
      "conductivity",
      "u_value",
      "specific_heat",
      "length",
      "length_mm",
      "area",
      "volume",
      "volume_liters",
      "flow_rate",
      "temperature",
      "airflow",
      "electric_efficiency",
      "heat_loss_rate",
      "energy",
      "power",
    ]);
    expect(isCompatibleNumberUnitPair("area", "m2", "ft2")).toBe(true);
    expect(isCompatibleNumberUnitPair("area", "m3", "ft3")).toBe(false);
    expect(numberUnitRegistrySnapshot()).toEqual({
      density: { si: ["kg_m3"], ip: ["lb_ft3"] },
      conductivity: { si: ["w_m_k"], ip: ["btu_h_ft_f"] },
      u_value: { si: ["w_m2_k"], ip: ["btu_h_ft2_f"] },
      specific_heat: { si: ["j_kg_k"], ip: ["btu_lb_f"] },
      length: { si: ["m"], ip: ["ft"] },
      length_mm: { si: ["mm"], ip: ["in"] },
      area: { si: ["m2"], ip: ["ft2"] },
      volume: { si: ["m3"], ip: ["ft3"] },
      volume_liters: { si: ["l"], ip: ["gal"] },
      flow_rate: { si: ["l_min"], ip: ["gpm"] },
      temperature: { si: ["c"], ip: ["f"] },
      airflow: { si: ["m3_h"], ip: ["cfm"] },
      electric_efficiency: { si: ["wh_m3"], ip: ["w_cfm"] },
      heat_loss_rate: { si: ["w_k"], ip: ["btu_h_f"] },
      energy: { si: ["kwh"], ip: ["kbtu"] },
      power: { si: ["kw"], ip: ["kbtu_h"] },
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
});
