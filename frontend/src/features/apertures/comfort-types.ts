// Wire shapes for Phius per-lite window thermal-comfort screening (#72).
// Mirror `backend/features/aperture_u_value/comfort.py`.

export type ComfortState = "pass" | "fail" | "exempt" | "alternative" | "blocked";
export type ComfortGoverningRoute = "project_specific" | "nfrc_standard";
export type ComfortExemptReason = "non_regularly_occupied" | "ada_door";
export type ComfortBlockedReason =
  | "missing_sill_height"
  | "missing_climate_source"
  | "missing_element_u_value"
  | "no_glazed_elements";

export type ApertureElementComfortResult = {
  element_id: string;
  element_name: string;
  row_span: [number, number];
  column_span: [number, number];
  head_height_mm: number | null;
  delta_t_max_f: number | null;
  u_max_w_m2k: number | null;
  u_project_specific_w_m2k: number | null;
  u_nfrc_standard_w_m2k: number | null;
  governing_route: ComfortGoverningRoute | null;
  margin: number | null;
  state: ComfortState;
  comfort_exempt: boolean;
  comfort_exempt_reason: ComfortExemptReason | null;
  perimeter_heat_within_3ft: boolean;
  perimeter_heat_note: string | null;
  nfrc_route_missing_caveat: boolean;
};

export type ApertureThermalComfortResult = {
  aperture_type_id: string;
  aperture_type_name: string;
  sill_height_mm: number | null;
  nfrc_whole_window_u_w_m2k: number | null;
  nfrc_standard_size_note: string | null;
  state: ComfortState;
  blocked_reasons: ComfortBlockedReason[];
  failing_count: number;
  governing_element_id: string | null;
  governing_element_name: string | null;
  heating_990_db_c: number | null;
  climate_source_label: string | null;
  climate_source_basis: string | null;
  ruleset: string;
  elements: ApertureElementComfortResult[];
};

export type AperturesThermalComfortListResponse = {
  project_id: string;
  version_id: string;
  source: "draft" | "version";
  apertures: ApertureThermalComfortResult[];
};
