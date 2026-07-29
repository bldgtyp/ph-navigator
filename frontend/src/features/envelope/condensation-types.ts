import type { EnvelopeReadSource, ThermalStandard } from "./types";

export type CondensationState = "screened" | "blocked" | "not_screened";
export type CondensationVerdict = "d1" | "d2" | "d3" | "d4";
export type CondensationStatusFlag =
  | "missing_material"
  | "missing_conductivity"
  | "invalid_geometry"
  | "broken_material_reference"
  | "no_thermal_layers"
  | "missing_vapor_data"
  | "missing_membrane_sd"
  | "missing_climate_source"
  | "zero_total_sd"
  | "invalid_climate_data"
  | "invalid_settings"
  | "ground_not_screened"
  | "unconditioned_space_not_screened"
  | "path_limit_fallback";

export type CondensationIssue = {
  code: CondensationStatusFlag;
  message: string;
  assembly_id: string;
  assembly_name: string;
  layer_id: string | null;
  layer_order: number | null;
  segment_id: string | null;
  segment_order: number | null;
  project_material_id: string | null;
  project_material_name: string | null;
};

export type CondensationCaveat = {
  code: "high_storage_masonry" | "multiple_condensing_interfaces" | "climate_rh_clamped";
  material_ids: string[];
};

export type CondensationSettings = {
  interior_climate_model: "iso13788_continental" | "iso13788_humidity_class" | "fixed_setpoint";
  occupancy_class: "low" | "normal" | "high";
  humidity_class: number;
  setpoint_temp_c: number | null;
  setpoint_rh: number | null;
  ma_limit_g_m2: number;
};

export type CondensationDiagnostic = {
  code:
    | "ventilated_stack_convention"
    | "path_limit_fallback"
    | "roof_temperature_offset"
    | "iso_6946_exterior_rule_with_non_iso_films";
  layer_id: string | null;
};

export type CondensationCriterion = {
  code: "surface_condensation" | "mold_growth" | "frsi" | "interstitial";
  is_clear: boolean;
  worst_month: number;
  worst_month_name: string;
  margin: number | null;
};

export type CondensationCriteria = {
  surface_condensation: CondensationCriterion;
  mold_growth: CondensationCriterion;
  frsi: CondensationCriterion;
  interstitial: CondensationCriterion;
};

export type CondensationNodeProfile = {
  node_index: number;
  outside_layer_id: string | null;
  cumulative_thickness_m: number;
  cumulative_sd_m: number;
  temperature_c: number;
  saturation_pressure_pa: number;
  vapor_pressure_pa: number;
  relative_humidity: number;
  is_condensing: boolean;
};

export type CondensationInterfaceMonth = {
  node_index: number;
  outside_layer_id: string;
  inside_layer_id: string;
  condensation_rate_kg_m2_s: number;
  moisture_change_g_m2: number;
  accumulated_moisture_g_m2: number;
};

export type CondensationMonth = {
  month: number;
  month_name: string;
  exterior_air_temp_c: number;
  exterior_profile_temp_c: number;
  exterior_rh: number;
  interior_temp_c: number;
  interior_rh: number;
  exterior_vapor_pressure_pa: number;
  interior_vapor_pressure_pa: number;
  interior_surface_temp_c: number;
  dewpoint_threshold_c: number;
  mold_threshold_c: number;
  frsi: number;
  frsi_min: number;
  surface_condensation_clear: boolean;
  mold_growth_clear: boolean;
  frsi_clear: boolean;
  condensing_interface_count: number;
  moisture_change_g_m2: number;
  accumulated_moisture_g_m2: number;
  nodes: CondensationNodeProfile[];
  interfaces: CondensationInterfaceMonth[];
};

export type CondensationPathSummary = {
  path_id: string;
  label: string;
  area_fraction: number;
  verdict: CondensationVerdict;
  peak_accumulated_moisture_g_m2: number;
  final_accumulated_moisture_g_m2: number;
  interface_count: number;
};

export type CondensationInterfaceSummary = {
  node_index: number;
  outside_layer_id: string;
  inside_layer_id: string;
  peak_accumulated_moisture_g_m2: number;
  condensing_months: number[];
};

export type AssemblyCondensationResponse = {
  project_id: string;
  version_id: string;
  source: EnvelopeReadSource;
  assembly_id: string;
  climate_source: {
    id: string;
    kind: "custom" | "phi" | "phius";
    label: string | null;
  } | null;
  status: {
    state: CondensationState;
    is_complete: boolean;
    flags: CondensationStatusFlag[];
  };
  input_hash: string;
  issues: CondensationIssue[];
  caveats: CondensationCaveat[];
  diagnostics: CondensationDiagnostic[];
  rsi_m2k_w: number;
  rse_m2k_w: number;
  thermal_standard: ThermalStandard;
  settings: CondensationSettings;
  roof_temperature_offset_k: number;
  path_count: number;
  paths_evaluated: number;
  worst_path_id: string | null;
  path_summaries: CondensationPathSummary[];
  verdict: CondensationVerdict | null;
  criteria: CondensationCriteria | null;
  interface_count: number;
  interfaces: CondensationInterfaceSummary[];
  start_month: number | null;
  start_month_name: string | null;
  peak_accumulated_moisture_g_m2: number | null;
  final_accumulated_moisture_g_m2: number | null;
  monthly: CondensationMonth[];
};
