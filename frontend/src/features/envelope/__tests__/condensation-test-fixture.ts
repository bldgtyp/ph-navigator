import type { AssemblyCondensationResponse, CondensationMonth } from "../condensation-types";
import type { Assembly, ProjectMaterial } from "../types";

export const condensationAssembly: Assembly = {
  id: "assembly",
  name: "Retrofit wall",
  type: "wall",
  orientation: "first_layer_outside",
  exterior_condition: "outdoor_air",
  layers: [
    {
      id: "layer-osb",
      order: 0,
      thickness_mm: 12,
      segments: [
        {
          id: "segment-osb",
          order: 0,
          width_mm: 400,
          is_continuous_insulation: true,
          steel_stud_spacing_mm: null,
          project_material_id: "material-osb",
          photo_asset_ids: [],
          use_site_notes: null,
        },
      ],
    },
    {
      id: "layer-insulation",
      order: 1,
      thickness_mm: 140,
      segments: [
        {
          id: "segment-insulation",
          order: 0,
          width_mm: 350,
          is_continuous_insulation: false,
          steel_stud_spacing_mm: null,
          project_material_id: "material-insulation",
          photo_asset_ids: [],
          use_site_notes: null,
        },
        {
          id: "segment-stud",
          order: 1,
          width_mm: 50,
          is_continuous_insulation: false,
          steel_stud_spacing_mm: 400,
          project_material_id: "material-stud",
          photo_asset_ids: [],
          use_site_notes: null,
        },
      ],
    },
  ],
  air_barrier: null,
  air_barrier_status: null,
  total_thickness_mm: 152,
  status: { is_complete: true, flags: [] },
};

export const condensationMaterials = [
  material("material-osb", "OSB", "masonry"),
  material("material-insulation", "Cellulose", "insulation"),
  material("material-stud", "Wood stud", "structure"),
];

export function screenedCondensationResult(
  overrides: Partial<AssemblyCondensationResponse> = {},
): AssemblyCondensationResponse {
  const monthly = Array.from({ length: 12 }, (_, index) => condensationMonth(index + 1));
  return {
    project_id: "project",
    version_id: "version",
    source: "draft",
    assembly_id: "assembly",
    climate_source: { id: "climate", kind: "custom", label: "Synthetic climate" },
    status: { state: "screened", is_complete: true, flags: [] },
    input_hash: "d".repeat(64),
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
    path_count: 2,
    paths_evaluated: 2,
    worst_path_id: "segment-osb|segment-stud",
    path_summaries: [
      {
        path_id: "segment-osb|segment-insulation",
        label: "1: OSB · 2: Cellulose",
        area_fraction: 0.875,
        verdict: "d1",
        peak_accumulated_moisture_g_m2: 0,
        final_accumulated_moisture_g_m2: 0,
        interface_count: 0,
      },
      {
        path_id: "segment-osb|segment-stud",
        label: "1: OSB · 2: Wood stud",
        area_fraction: 0.125,
        verdict: "d2",
        peak_accumulated_moisture_g_m2: 84,
        final_accumulated_moisture_g_m2: 0,
        interface_count: 1,
      },
    ],
    verdict: "d2",
    criteria: {
      surface_condensation: criterion("surface_condensation", true, 1, "January", 4.1),
      mold_growth: criterion("mold_growth", true, 1, "January", 1.8),
      frsi: criterion("frsi", true, 1, "January", 0.07),
      interstitial: criterion("interstitial", true, 3, "March", 116),
    },
    interface_count: 1,
    interfaces: [
      {
        node_index: 1,
        outside_layer_id: "layer-osb",
        inside_layer_id: "layer-insulation",
        peak_accumulated_moisture_g_m2: 84,
        condensing_months: [1, 2],
      },
    ],
    start_month: 10,
    start_month_name: "October",
    peak_accumulated_moisture_g_m2: 84,
    final_accumulated_moisture_g_m2: 0,
    monthly,
    ...overrides,
  };
}

function condensationMonth(month: number): CondensationMonth {
  const monthName = new Date(2026, month - 1, 1).toLocaleString("en", { month: "long" });
  const accumulated = month <= 3 ? month * 28 : Math.max(0, 84 - (month - 3) * 14);
  const hasInterface = month <= 8;
  return {
    month,
    month_name: monthName,
    exterior_air_temp_c: -6 + month,
    exterior_profile_temp_c: -6 + month,
    exterior_rh: 0.8,
    interior_temp_c: 20,
    interior_rh: 0.5,
    exterior_vapor_pressure_pa: 300,
    interior_vapor_pressure_pa: 1170,
    interior_surface_temp_c: 16,
    dewpoint_threshold_c: 9.3,
    mold_threshold_c: 12.6,
    frsi: 0.78,
    frsi_min: 0.7,
    surface_condensation_clear: true,
    mold_growth_clear: true,
    frsi_clear: true,
    condensing_interface_count: hasInterface ? 1 : 0,
    moisture_change_g_m2: month <= 3 ? 28 : -14,
    accumulated_moisture_g_m2: accumulated,
    nodes: [
      node(0, null, 0, 0, -4 + month, 430, 300, false),
      node(1, "layer-osb", 0.012, 2.4, 2 + month, 705, 705, month <= 2),
      node(2, "layer-insulation", 0.152, 3.1, 16, 1818, 1170, false),
    ],
    interfaces: hasInterface
      ? [
          {
            node_index: 1,
            outside_layer_id: "layer-osb",
            inside_layer_id: "layer-insulation",
            condensation_rate_kg_m2_s: month <= 2 ? 1e-9 : -1e-9,
            moisture_change_g_m2: month <= 3 ? 28 : -14,
            accumulated_moisture_g_m2: accumulated,
          },
        ]
      : [],
  };
}

function node(
  nodeIndex: number,
  outsideLayerId: string | null,
  cumulativeThickness: number,
  cumulativeSd: number,
  temperature: number,
  saturationPressure: number,
  vaporPressure: number,
  isCondensing: boolean,
) {
  return {
    node_index: nodeIndex,
    outside_layer_id: outsideLayerId,
    cumulative_thickness_m: cumulativeThickness,
    cumulative_sd_m: cumulativeSd,
    temperature_c: temperature,
    saturation_pressure_pa: saturationPressure,
    vapor_pressure_pa: vaporPressure,
    relative_humidity: vaporPressure / saturationPressure,
    is_condensing: isCondensing,
  };
}

function criterion(
  code: "surface_condensation" | "mold_growth" | "frsi" | "interstitial",
  isClear: boolean,
  worstMonth: number,
  worstMonthName: string,
  margin: number,
) {
  return {
    code,
    is_clear: isClear,
    worst_month: worstMonth,
    worst_month_name: worstMonthName,
    margin,
  };
}

function material(id: string, name: string, category: string): ProjectMaterial {
  return {
    id,
    name,
    category,
    density_kg_m3: null,
    specific_heat_j_kgk: null,
    conductivity_w_mk: 0.1,
    emissivity: null,
    air_permeance_l_s_m2_at_75pa: null,
    vapor_diffusion_resistance_mu: 20,
    vapor_sd_equivalent_m: null,
    color: null,
    source: null,
    url: null,
    comments: null,
    specification_status: "needed",
    datasheet_asset_ids: [],
    catalog_origin: null,
    use_sites: [],
  };
}
