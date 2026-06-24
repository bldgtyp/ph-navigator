import { DEFAULT_BUILT_IN_LOCKS } from "../../../shared/ui/data-table/lib/locks";
import type {
  FieldOption,
  TableFieldDef,
  TableFieldRenderOverlay,
  TableFieldRenderOverlays,
} from "../../../shared/ui/data-table";

export const FRAME_TYPES_TABLE_KEY = "catalog_frame_types";

// The six promoted single-select fields (backend `FRAME_TYPE_SINGLE_SELECT_FIELDS`).
export const FRAME_TYPES_SINGLE_SELECT_FIELDS = [
  "manufacturer",
  "brand",
  "use",
  "operation",
  "location",
  "mull_type",
] as const;

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
  builtInFieldDef("manufacturer", "Manufacturer", "single_select"),
  builtInFieldDef("brand", "Brand", "single_select"),
  builtInFieldDef("use", "Use", "single_select"),
  builtInFieldDef("operation", "Operation", "single_select"),
  builtInFieldDef("location", "Location", "single_select"),
  builtInFieldDef("mull_type", "Mull type", "single_select"),
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

// The six categorization fields are strict single-selects (window-frames-catalog-
// enums) whose options come from the catalog option store at runtime. `name` is
// server-derived (D-3) so it renders read-only. Phase 5a keeps the `options`
// attribute locked (pick-from-canonical only); Phase 5b unlocks editing.
const SINGLE_SELECT_BASE_OVERLAY: TableFieldRenderOverlay = {
  locked: [...DEFAULT_BUILT_IN_LOCKS, "field_type", "options"],
};

const FRAME_TYPES_STATIC_OVERLAY: TableFieldRenderOverlays = {
  name: { locked: DEFAULT_BUILT_IN_LOCKS, read_only: true },
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

// Build the render overlay with the fetched option lists injected into the six
// single-select fields. Called per-render from the page with the options query.
export function buildFrameTypesFieldOverlay(
  optionsByField: Record<string, FieldOption[]>,
): TableFieldRenderOverlays {
  const singleSelects: TableFieldRenderOverlays = {};
  for (const field of FRAME_TYPES_SINGLE_SELECT_FIELDS) {
    singleSelects[field] = {
      ...SINGLE_SELECT_BASE_OVERLAY,
      options: optionsByField[field] ?? [],
    };
  }
  return { ...singleSelects, ...FRAME_TYPES_STATIC_OVERLAY };
}
