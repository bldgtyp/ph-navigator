import { DEFAULT_BUILT_IN_LOCKS } from "../../../shared/ui/data-table/lib/locks";
import type {
  FieldOption,
  TableFieldDef,
  TableFieldRenderOverlays,
} from "../../../shared/ui/data-table";
import { MATERIAL_CATEGORY_IDS, type MaterialCategoryId } from "../types";

export const MATERIALS_TABLE_KEY = "catalog_materials";

const BUILT_IN_FIELD_CREATED_AT = "2026-06-03T00:00:00Z";

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

export const MATERIALS_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("name", "Name", "short_text"),
  builtInFieldDef("category", "Category", "single_select"),
  builtInFieldDef("density_kg_m3", "Density", "number"),
  builtInFieldDef("specific_heat_j_kgk", "Specific Heat", "number"),
  builtInFieldDef("conductivity_w_mk", "Conductivity", "number"),
  builtInFieldDef("emissivity", "Emissivity", "number"),
  builtInFieldDef("color", "Color", "color"),
  builtInFieldDef("source", "Source", "short_text"),
  builtInFieldDef("url", "URL", "url"),
  builtInFieldDef("comments", "Comments", "long_text"),
];

// Twelve fixed options. The labels match what BLDGTYP uses on drawings
// and material schedules — the registry id is the persisted value.
const CATEGORY_LABELS: Record<MaterialCategoryId, string> = {
  insulation: "Insulation",
  finishes: "Finishes",
  woods: "Woods",
  metals: "Metals",
  masonry: "Masonry",
  stud_layers_steel: "Stud-Layers (Steel)",
  stud_layers_wood: "Stud-Layers (Wood)",
  air_horizontal_heat_flow: "Air: Horizontal Heat Flow",
  air_upward_heat_flow: "Air: Upward Heat Flow",
  air_downward_heat_flow: "Air: Downward Heat Flow",
  rainscreen_insulation: "Rainscreen Insulation",
  doors: "Doors",
};

// Quiet neutral palette — categories are organizational, not status. The
// DataTable colour-codes single_select pills from the option `color`,
// and we don't want the cells fighting for attention with the values.
const CATEGORY_COLOR = "#e5e7eb";

export const MATERIAL_CATEGORY_OPTIONS: FieldOption[] = MATERIAL_CATEGORY_IDS.map((id, index) => ({
  id: `opt_${id}`,
  label: CATEGORY_LABELS[id],
  color: CATEGORY_COLOR,
  order: index,
}));

const MATERIAL_CATEGORY_VALUE_BY_OPTION_ID: Record<string, MaterialCategoryId> = Object.fromEntries(
  MATERIAL_CATEGORY_IDS.map((id) => [`opt_${id}`, id]),
);

export function materialCategoryFromOptionId(optionId: string | null): MaterialCategoryId | null {
  if (optionId === null) return null;
  return MATERIAL_CATEGORY_VALUE_BY_OPTION_ID[optionId] ?? null;
}

export const MATERIALS_FIELD_OVERLAY: TableFieldRenderOverlays = {
  name: { locked: DEFAULT_BUILT_IN_LOCKS, required: true },
  category: {
    locked: ["field_type", "options", "delete", "duplicate"],
    options: MATERIAL_CATEGORY_OPTIONS,
    required: true,
  },
  density_kg_m3: {
    locked: DEFAULT_BUILT_IN_LOCKS,
    numberUnits: {
      mode: "fixed",
      unit_type: "density",
      si_unit: "kg_m3",
      ip_unit: "lb_ft3",
      precision_si: 1,
      precision_ip: 1,
    },
  },
  specific_heat_j_kgk: {
    locked: DEFAULT_BUILT_IN_LOCKS,
    numberUnits: {
      mode: "fixed",
      unit_type: "specific_heat",
      si_unit: "j_kg_k",
      ip_unit: "btu_lb_f",
      precision_si: 0,
      precision_ip: 3,
    },
  },
  conductivity_w_mk: {
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
  emissivity: { locked: DEFAULT_BUILT_IN_LOCKS, numberPrecision: 2 },
  color: { locked: DEFAULT_BUILT_IN_LOCKS },
  source: { locked: DEFAULT_BUILT_IN_LOCKS },
  url: { locked: DEFAULT_BUILT_IN_LOCKS },
  comments: { locked: DEFAULT_BUILT_IN_LOCKS },
};
