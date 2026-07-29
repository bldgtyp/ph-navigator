import { describe, expect, test } from "vitest";
import {
  condensationChipPresentation,
  type CondensationChipPresentation,
} from "../condensation-chip";
import type { AssemblyCondensationResponse, CondensationIssue } from "../condensation-types";

describe("condensationChipPresentation", () => {
  test.each([
    ["clear", result(), { label: "Condensation: none predicted", tone: "success", muted: false }],
    [
      "clear with caveats",
      result({ caveats: [{ code: "climate_rh_clamped", material_ids: [] }] }),
      {
        label: "Condensation: none predicted (1 caveat)",
        tone: "success",
        muted: true,
      },
    ],
    [
      "risk",
      result({ verdict: "d2" }),
      { label: "Condensation: predicted — review", tone: "warning", muted: false },
    ],
    [
      "over limit",
      result({ verdict: "d3" }),
      { label: "Condensation: exceeds limit", tone: "danger", muted: false },
    ],
    [
      "low confidence",
      result({
        caveats: [{ code: "multiple_condensing_interfaces", material_ids: [] }],
      }),
      { label: "Condensation: multiple interfaces", tone: "warning", muted: true },
    ],
    [
      "blocked data",
      result({
        status: {
          state: "blocked",
          is_complete: false,
          flags: ["missing_vapor_data"],
        },
        verdict: null,
        issues: [vaporIssue("material-a"), vaporIssue("material-a"), vaporIssue("material-b")],
      }),
      { label: "Condensation: needs vapour data (2)", tone: "neutral", muted: false },
    ],
    [
      "blocked climate",
      result({
        status: {
          state: "blocked",
          is_complete: false,
          flags: ["missing_climate_source"],
        },
        verdict: null,
      }),
      {
        label: "Condensation: needs a climate source",
        tone: "neutral",
        muted: false,
      },
    ],
    [
      "out of scope",
      result({
        status: {
          state: "not_screened",
          is_complete: false,
          flags: ["ground_not_screened"],
        },
        verdict: null,
      }),
      { label: "Condensation: not screened", tone: "neutral", muted: false },
    ],
  ] satisfies [string, AssemblyCondensationResponse, CondensationChipPresentation][])(
    "%s",
    (_name, response, expected) => {
      expect(condensationChipPresentation(response, false, false)).toEqual(expected);
    },
  );
});

function result(
  overrides: Partial<AssemblyCondensationResponse> = {},
): AssemblyCondensationResponse {
  return {
    project_id: "project",
    version_id: "version",
    source: "draft",
    assembly_id: "assembly",
    climate_source: null,
    status: { state: "screened", is_complete: true, flags: [] },
    input_hash: "a".repeat(64),
    issues: [],
    caveats: [],
    diagnostics: [],
    rsi_m2k_w: 0.13,
    rse_m2k_w: 0.04,
    thermal_standard: "iso_6946",
    settings: {
      interior_climate_model: "iso13788_continental",
      occupancy_class: "normal",
      humidity_class: 2,
      setpoint_temp_c: null,
      setpoint_rh: null,
      ma_limit_g_m2: 200,
    },
    roof_temperature_offset_k: 0,
    path_count: 1,
    paths_evaluated: 1,
    worst_path_id: "path",
    path_summaries: [],
    verdict: "d1",
    criteria: null,
    interface_count: 0,
    interfaces: [],
    start_month: 1,
    start_month_name: "January",
    peak_accumulated_moisture_g_m2: 0,
    final_accumulated_moisture_g_m2: 0,
    monthly: [],
    ...overrides,
  };
}

function vaporIssue(materialId: string): CondensationIssue {
  return {
    code: "missing_vapor_data",
    message: "Vapour data needed.",
    assembly_id: "assembly",
    assembly_name: "Wall",
    layer_id: "layer",
    layer_order: 0,
    segment_id: "segment",
    segment_order: 0,
    project_material_id: materialId,
    project_material_name: materialId,
  };
}
