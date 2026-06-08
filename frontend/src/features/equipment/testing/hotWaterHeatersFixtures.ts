import {
  buildTableSchema,
  useTableSchema,
  type TableFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { HOT_WATER_HEATERS_COMPAT_BUILT_IN_FIELD_DEFS, hotWaterHeatersFieldOverlay } from "../lib";
import {
  HOT_WATER_HEATER_TYPE_OPTION_KEY,
  HOT_WATER_HEATERS_TABLE_NAME,
  type HotWaterHeaterRow,
  type HotWaterHeatersSlice,
} from "../types";

function copyTableFieldDef(fieldDef: TableFieldDef): TableFieldDef {
  return { ...fieldDef, config: { ...fieldDef.config } };
}

export const hotWaterHeatersBuiltInFieldDefs: TableFieldDef[] = [
  ...HOT_WATER_HEATERS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function hotWaterHeatersFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...hotWaterHeatersBuiltInFieldDefs, ...customFields];
}

export function buildHotWaterHeater(overrides: Partial<HotWaterHeaterRow> = {}): HotWaterHeaterRow {
  return {
    id: "hwh_1",
    heater_type: "opt_hwh_heat_pump_annual_cop",
    phase: 1,
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: "HWH-1",
      name: "DHW heater",
      quantity: 1,
      model: "ST-80",
      manufacturer: "Acme",
      size_l: 302.8,
      temperature_c: 60,
      amps: 1.2,
      volts: 120,
      power_factor: 0.8,
      watts: 120,
      uef: 0.92,
    },
    ...overrides,
  };
}

export function buildHotWaterHeatersSlice(
  overrides: Partial<HotWaterHeatersSlice> = {},
): HotWaterHeatersSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    hot_water_heaters: [],
    field_defs: hotWaterHeatersFieldDefs(),
    single_select_options: {
      [HOT_WATER_HEATER_TYPE_OPTION_KEY]: [
        { id: "opt_hwh_electric", label: "1-Electric", color: "#ef4444", order: 0 },
        { id: "opt_hwh_boiler_gas_oil", label: "2-Boiler (Gas/Oil)", color: "#f97316", order: 1 },
        { id: "opt_hwh_boiler_wood", label: "3-Boiler (Wood)", color: "#92400e", order: 2 },
        { id: "opt_hwh_district", label: "4-District", color: "#6366f1", order: 3 },
        {
          id: "opt_hwh_heat_pump_annual_cop",
          label: "5-Heat Pump (Annual COP)",
          color: "#10b981",
          order: 4,
        },
        {
          id: "opt_hwh_heat_pump_monthly_cop",
          label: "6-Heat Pump (Monthly COP)",
          color: "#14b8a6",
          order: 5,
        },
        {
          id: "opt_hwh_heat_pump_inside",
          label: "7-Heat Pump (Inside)",
          color: "#0ea5e9",
          order: 6,
        },
      ],
    },
    ...overrides,
  };
}

export function schemaForHotWaterHeaters(slice: HotWaterHeatersSlice): TableSchema {
  return buildTableSchema({
    tableKey: HOT_WATER_HEATERS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: hotWaterHeatersFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function useHotWaterHeatersTableSchema(slice: HotWaterHeatersSlice): TableSchema {
  return useTableSchema({
    tableKey: HOT_WATER_HEATERS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: hotWaterHeatersFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}
