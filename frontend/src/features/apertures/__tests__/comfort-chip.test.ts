import { describe, expect, it } from "vitest";
import { thermalComfortChipPresentation } from "../comfort-chip";
import type { ApertureThermalComfortResult } from "../comfort-types";

function makeResult(
  overrides: Partial<ApertureThermalComfortResult> = {},
): ApertureThermalComfortResult {
  return {
    aperture_type_id: "apt_1",
    aperture_type_name: "W-01",
    sill_height_mm: 900,
    nfrc_whole_window_u_w_m2k: null,
    nfrc_standard_size_note: null,
    state: "pass",
    blocked_reasons: [],
    failing_count: 0,
    governing_element_id: "aptel_1",
    governing_element_name: "Lite 1",
    heating_990_db_c: -10,
    climate_source_label: "NYC",
    climate_source_basis: "ASHRAE 2021",
    ruleset: "phius-2024-r1",
    elements: [],
    ...overrides,
  };
}

describe("thermalComfortChipPresentation", () => {
  it("maps loading, unavailable, and blocked states", () => {
    expect(thermalComfortChipPresentation(null, true, false)).toEqual({
      label: "Comfort: calculating",
      tone: "neutral",
      muted: true,
    });
    expect(thermalComfortChipPresentation(null, false, true)).toEqual({
      label: "Comfort: unavailable",
      tone: "neutral",
      muted: true,
    });
    expect(
      thermalComfortChipPresentation(
        makeResult({ state: "blocked", blocked_reasons: ["missing_sill_height"] }),
        false,
        false,
      ),
    ).toEqual({
      label: "Comfort: needs sill height",
      tone: "neutral",
      muted: false,
    });
    expect(
      thermalComfortChipPresentation(
        makeResult({ state: "blocked", blocked_reasons: ["missing_climate_source"] }),
        false,
        false,
      ),
    ).toEqual({
      label: "Comfort: needs a climate source",
      tone: "neutral",
      muted: false,
    });
  });

  it("maps pass, fail, alternative, and exempt states", () => {
    expect(thermalComfortChipPresentation(makeResult({ state: "pass" }), false, false)).toEqual({
      label: "Comfort: OK",
      tone: "success",
      muted: false,
    });
    expect(
      thermalComfortChipPresentation(makeResult({ state: "fail", failing_count: 3 }), false, false),
    ).toEqual({
      label: "Comfort: 3 lites fail",
      tone: "danger",
      muted: false,
    });
    expect(
      thermalComfortChipPresentation(makeResult({ state: "alternative" }), false, false),
    ).toEqual({
      label: "Comfort: passes on alternative",
      tone: "warning",
      muted: false,
    });
    expect(thermalComfortChipPresentation(makeResult({ state: "exempt" }), false, false)).toEqual({
      label: "Comfort: exempt",
      tone: "neutral",
      muted: true,
    });
  });
});
