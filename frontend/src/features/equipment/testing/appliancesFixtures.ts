import {
  buildTableSchema,
  useTableSchema,
  type TableFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { APPLIANCES_COMPAT_BUILT_IN_FIELD_DEFS, appliancesFieldOverlay } from "../lib";
import {
  APPLIANCE_ENERGY_STAR_OPTION_KEY,
  APPLIANCE_TYPE_OPTION_KEY,
  APPLIANCES_TABLE_NAME,
  type ApplianceRow,
  type AppliancesSlice,
} from "../types";

function copyTableFieldDef(fieldDef: TableFieldDef): TableFieldDef {
  return { ...fieldDef, config: { ...fieldDef.config } };
}

export const appliancesBuiltInFieldDefs: TableFieldDef[] = [
  ...APPLIANCES_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function appliancesFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...appliancesBuiltInFieldDefs, ...customFields];
}

export function buildAppliance(overrides: Partial<ApplianceRow> = {}): ApplianceRow {
  return {
    id: "appl_1",
    appliance_type: "opt_appl_fridge",
    energy_star: "opt_appl_energy_star_yes",
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: "A-1",
      name: "Kitchen refrigerator",
      quantity: 1,
      model: "RF-36",
      manufacturer: "Acme",
      capacity_m3: 0.62,
      cef: 12.1,
      imef: 2.76,
      mef: 2.2,
      annual_energy_kwh: 420,
    },
    ...overrides,
  };
}

export function buildAppliancesSlice(overrides: Partial<AppliancesSlice> = {}): AppliancesSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    appliances: [],
    field_defs: appliancesFieldDefs(),
    single_select_options: {
      [APPLIANCE_TYPE_OPTION_KEY]: [
        { id: "opt_appl_dishwasher", label: "1-dishwasher", color: "#0ea5e9", order: 0 },
        { id: "opt_appl_clothes_washer", label: "2-clothes_washer", color: "#14b8a6", order: 1 },
        { id: "opt_appl_clothes_dryer", label: "3-clothes_dryer", color: "#f97316", order: 2 },
        { id: "opt_appl_fridge", label: "4-fridge", color: "#3b82f6", order: 3 },
        { id: "opt_appl_freezer", label: "5-freezer", color: "#6366f1", order: 4 },
        { id: "opt_appl_fridge_freezer", label: "6-fridge_freezer", color: "#8b5cf6", order: 5 },
        { id: "opt_appl_cooking", label: "7-cooking", color: "#ef4444", order: 6 },
        { id: "opt_appl_phius_mel", label: "13-PHIUS_MEL", color: "#f59e0b", order: 7 },
        {
          id: "opt_appl_phius_lighting_int",
          label: "14-PHIUS_Lighting_Int",
          color: "#84cc16",
          order: 8,
        },
        {
          id: "opt_appl_phius_lighting_ext",
          label: "15-PHIUS_Lighting_Ext",
          color: "#22c55e",
          order: 9,
        },
        {
          id: "opt_appl_phius_lighting_garage",
          label: "16-PHIUS_Lighting_Garage",
          color: "#10b981",
          order: 10,
        },
        {
          id: "opt_appl_custom_electric_per_year",
          label: "11-Custom_Electric_per_Year",
          color: "#06b6d4",
          order: 11,
        },
        {
          id: "opt_appl_custom_electric_lighting_per_year",
          label: "17-Custom_Electric_Lighting_per_Year",
          color: "#6366f1",
          order: 12,
        },
        {
          id: "opt_appl_custom_electric_mel_per_use",
          label: "18-Custom_Electric_MEL_per_Use",
          color: "#8b5cf6",
          order: 13,
        },
        {
          id: "opt_appl_commercial_dishwasher",
          label: "21-Commercial_Dishwasher",
          color: "#a855f7",
          order: 14,
        },
        {
          id: "opt_appl_commercial_refrigerator",
          label: "22-Commercial_Refrigerator",
          color: "#d946ef",
          order: 15,
        },
        {
          id: "opt_appl_commercial_cooking",
          label: "23-Commercial_Cooking",
          color: "#ec4899",
          order: 16,
        },
        {
          id: "opt_appl_commercial_custom",
          label: "24-Commercial_Custom",
          color: "#64748b",
          order: 17,
        },
      ],
      [APPLIANCE_ENERGY_STAR_OPTION_KEY]: [
        { id: "opt_appl_energy_star_yes", label: "Yes", color: "#10b981", order: 0 },
        { id: "opt_appl_energy_star_no", label: "No", color: "#64748b", order: 1 },
      ],
    },
    ...overrides,
  };
}

export function schemaForAppliances(slice: AppliancesSlice): TableSchema {
  return buildTableSchema({
    tableKey: APPLIANCES_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: appliancesFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function useAppliancesTableSchema(slice: AppliancesSlice): TableSchema {
  return useTableSchema({
    tableKey: APPLIANCES_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: appliancesFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}
