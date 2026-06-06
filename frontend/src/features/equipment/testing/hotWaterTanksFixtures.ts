import {
  buildTableSchema,
  useTableSchema,
  type TableFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { HOT_WATER_TANKS_COMPAT_BUILT_IN_FIELD_DEFS, hotWaterTanksFieldOverlay } from "../lib";
import {
  HOT_WATER_TANK_TYPE_OPTION_KEY,
  HOT_WATER_TANKS_TABLE_NAME,
  type HotWaterTankRow,
  type HotWaterTanksSlice,
} from "../types";

function copyTableFieldDef(fieldDef: TableFieldDef): TableFieldDef {
  return { ...fieldDef, config: { ...fieldDef.config } };
}

export const hotWaterTanksBuiltInFieldDefs: TableFieldDef[] = [
  ...HOT_WATER_TANKS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function hotWaterTanksFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...hotWaterTanksBuiltInFieldDefs, ...customFields];
}

export function buildHotWaterTank(overrides: Partial<HotWaterTankRow> = {}): HotWaterTankRow {
  return {
    id: "hwt_1",
    tank_type: "opt_hwt_user_defined",
    phase: 1,
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: "HWT-1",
      name: "DHW storage tank",
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

export function buildHotWaterTanksSlice(
  overrides: Partial<HotWaterTanksSlice> = {},
): HotWaterTanksSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    hot_water_tanks: [],
    field_defs: hotWaterTanksFieldDefs(),
    single_select_options: {
      [HOT_WATER_TANK_TYPE_OPTION_KEY]: [
        { id: "opt_hwt_dryer", label: "1-Dryer", color: "#f97316", order: 0 },
        { id: "opt_hwt_kitchen_hood", label: "2-Kitchen Hood", color: "#0ea5e9", order: 1 },
        { id: "opt_hwt_user_defined", label: "3-User Defined", color: "#8b5cf6", order: 2 },
      ],
    },
    ...overrides,
  };
}

export function schemaForHotWaterTanks(slice: HotWaterTanksSlice): TableSchema {
  return buildTableSchema({
    tableKey: HOT_WATER_TANKS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: hotWaterTanksFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function useHotWaterTanksTableSchema(slice: HotWaterTanksSlice): TableSchema {
  return useTableSchema({
    tableKey: HOT_WATER_TANKS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: hotWaterTanksFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}
