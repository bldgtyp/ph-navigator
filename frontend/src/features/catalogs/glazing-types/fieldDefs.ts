import { DEFAULT_BUILT_IN_LOCKS } from "../../../shared/ui/data-table/lib/locks";
import type { TableFieldDef, TableFieldRenderOverlays } from "../../../shared/ui/data-table";

export const GLAZING_TYPES_TABLE_KEY = "catalog_glazing_types";

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

export const GLAZING_TYPES_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("name", "Name", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef("brand", "Brand", "short_text"),
  builtInFieldDef("suffix", "Suffix", "short_text"),
  builtInFieldDef("u_value_w_m2k", "U-value", "number"),
  builtInFieldDef("g_value", "g-value", "number"),
  builtInFieldDef("color", "Color", "color"),
  builtInFieldDef("source", "Source", "short_text"),
  builtInFieldDef("comments", "Comments", "long_text"),
];

export const GLAZING_TYPES_FIELD_OVERLAY: TableFieldRenderOverlays = {
  name: { locked: DEFAULT_BUILT_IN_LOCKS, required: true },
  manufacturer: { locked: DEFAULT_BUILT_IN_LOCKS },
  brand: { locked: DEFAULT_BUILT_IN_LOCKS },
  suffix: { locked: DEFAULT_BUILT_IN_LOCKS },
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
  // g-value (SHGC) is a dimensionless 0–1 fraction; no unit conversion.
  g_value: { locked: DEFAULT_BUILT_IN_LOCKS, numberPrecision: 2 },
  color: { locked: DEFAULT_BUILT_IN_LOCKS },
  source: { locked: DEFAULT_BUILT_IN_LOCKS },
  comments: { locked: DEFAULT_BUILT_IN_LOCKS },
};
