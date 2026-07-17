import { DEFAULT_BUILT_IN_LOCKS } from "../../../shared/ui/data-table/lib/locks";
import type {
  FieldOption,
  TableFieldDef,
  TableFieldRenderOverlay,
  TableFieldRenderOverlays,
} from "../../../shared/ui/data-table";

export const GLAZING_TYPES_TABLE_KEY = "catalog_glazing_types";

// The single promoted single-select field (backend `GLAZING_TYPE_SINGLE_SELECT_FIELDS`).
// `brand` is intentionally free text — it stays `short_text` below.
export const GLAZING_TYPES_SINGLE_SELECT_FIELDS = ["manufacturer"] as const;

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
  builtInFieldDef("manufacturer", "Manufacturer", "single_select"),
  builtInFieldDef("brand", "Brand", "short_text"),
  builtInFieldDef("suffix", "Suffix", "short_text"),
  builtInFieldDef("u_value_w_m2k", "U-value", "number"),
  builtInFieldDef("g_value", "g-value", "number"),
  builtInFieldDef("color", "Color", "color"),
  builtInFieldDef("source", "Source", "short_text"),
  builtInFieldDef("comments", "Comments", "long_text"),
];

// `manufacturer` is the one strict single-select (window-glass-catalog-enums)
// whose options come from the catalog option store at runtime. `name` is
// server-derived (D-3) so it renders read-only. The `options` attribute is
// unlocked so the field-config "manage options" path can add / rename / reorder
// / merge, routed to the REST store by the controller. `field_type` stays locked
// (these are fixed built-ins). `brand` is free text (a static overlay entry).
const SINGLE_SELECT_BASE_OVERLAY: TableFieldRenderOverlay = {
  locked: [...DEFAULT_BUILT_IN_LOCKS, "display_name", "description", "field_type"],
};

const GLAZING_TYPES_STATIC_OVERLAY: TableFieldRenderOverlays = {
  name: { locked: DEFAULT_BUILT_IN_LOCKS, read_only: true },
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

// Build the render overlay with the fetched option list injected into the
// `manufacturer` single-select field. Called per-render from the page with the
// options query.
export function buildGlazingTypesFieldOverlay(
  optionsByField: Record<string, FieldOption[]>,
): TableFieldRenderOverlays {
  const singleSelects: TableFieldRenderOverlays = {};
  for (const field of GLAZING_TYPES_SINGLE_SELECT_FIELDS) {
    singleSelects[field] = {
      ...SINGLE_SELECT_BASE_OVERLAY,
      options: optionsByField[field] ?? [],
    };
  }
  return { ...singleSelects, ...GLAZING_TYPES_STATIC_OVERLAY };
}
