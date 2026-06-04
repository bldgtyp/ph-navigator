import { DEFAULT_BUILT_IN_LOCKS } from "../../../shared/ui/data-table/lib/locks";
import type { TableFieldDef, TableFieldRenderOverlays } from "../../../shared/ui/data-table";

export const FRAME_TYPES_TABLE_KEY = "catalog_frame_types";

const BUILT_IN_FIELD_CREATED_AT = "2026-06-04T00:00:00Z";

function builtInFieldDef(
  field_key: string,
  display_name: string,
  field_type: TableFieldDef["field_type"],
): TableFieldDef {
  return {
    field_key,
    display_name,
    field_type,
    config: {},
    description: null,
    origin: "built_in",
    created_at: BUILT_IN_FIELD_CREATED_AT,
    created_by: null,
  };
}

export const FRAME_TYPES_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("name", "Name", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef("brand", "Brand", "short_text"),
  builtInFieldDef("use", "Use", "short_text"),
  builtInFieldDef("operation", "Operation", "short_text"),
  builtInFieldDef("location", "Location", "short_text"),
  builtInFieldDef("mull_type", "Mull type", "short_text"),
  builtInFieldDef("prefix", "Prefix", "short_text"),
  builtInFieldDef("suffix", "Suffix", "short_text"),
  builtInFieldDef("material", "Material", "short_text"),
  builtInFieldDef("width_mm", "Width", "number"),
  builtInFieldDef("u_value_w_m2k", "U-value", "number"),
  builtInFieldDef("psi_g_w_mk", "Ψ-glazing", "number"),
  builtInFieldDef("psi_install_w_mk", "Ψ-install", "number"),
  builtInFieldDef("color", "Color", "color"),
  builtInFieldDef("source", "Source", "short_text"),
  builtInFieldDef("comments", "Comments", "long_text"),
];

// Soft-enum columns (PRD D4) ship as plain `short_text` in v1 so the
// AirTable seed import absorbs any value verbatim. The PRD calls out
// promotion to strict `single_select` as a follow-up once the seeded
// option distribution is observable.
export const FRAME_TYPES_FIELD_OVERLAY: TableFieldRenderOverlays = {
  name: { locked: DEFAULT_BUILT_IN_LOCKS, required: true },
  manufacturer: { locked: DEFAULT_BUILT_IN_LOCKS },
  brand: { locked: DEFAULT_BUILT_IN_LOCKS },
  use: { locked: DEFAULT_BUILT_IN_LOCKS },
  operation: { locked: DEFAULT_BUILT_IN_LOCKS },
  location: { locked: DEFAULT_BUILT_IN_LOCKS },
  mull_type: { locked: DEFAULT_BUILT_IN_LOCKS },
  prefix: { locked: DEFAULT_BUILT_IN_LOCKS },
  suffix: { locked: DEFAULT_BUILT_IN_LOCKS },
  material: { locked: DEFAULT_BUILT_IN_LOCKS },
  width_mm: {
    locked: DEFAULT_BUILT_IN_LOCKS,
    numberUnits: {
      mode: "fixed",
      unit_type: "length_mm",
      si_unit: "mm",
      ip_unit: "in",
      precision_si: 1,
      precision_ip: 2,
    },
  },
  u_value_w_m2k: {
    locked: DEFAULT_BUILT_IN_LOCKS,
    numberUnits: {
      mode: "fixed",
      unit_type: "u_value",
      si_unit: "w_m2_k",
      ip_unit: "btu_h_ft2_f",
      precision_si: 3,
      precision_ip: 3,
    },
  },
  psi_g_w_mk: {
    locked: DEFAULT_BUILT_IN_LOCKS,
    numberUnits: {
      mode: "fixed",
      unit_type: "conductivity",
      si_unit: "w_m_k",
      ip_unit: "btu_h_ft_f",
      precision_si: 3,
      precision_ip: 3,
    },
  },
  psi_install_w_mk: {
    locked: DEFAULT_BUILT_IN_LOCKS,
    numberUnits: {
      mode: "fixed",
      unit_type: "conductivity",
      si_unit: "w_m_k",
      ip_unit: "btu_h_ft_f",
      precision_si: 3,
      precision_ip: 3,
    },
  },
  color: { locked: DEFAULT_BUILT_IN_LOCKS },
  source: { locked: DEFAULT_BUILT_IN_LOCKS },
  comments: { locked: DEFAULT_BUILT_IN_LOCKS },
};
