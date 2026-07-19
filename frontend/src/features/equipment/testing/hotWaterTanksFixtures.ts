import {
  buildTableSchema,
  useTableSchema,
  type TableFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import { HOT_WATER_TANKS_COMPAT_BUILT_IN_FIELD_DEFS, hotWaterTanksFieldOverlay } from "../lib";
import {
  HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY,
  HOT_WATER_TANK_TYPE_OPTION_KEY,
  HOT_WATER_TANKS_STATUS_OPTION_KEY,
  HOT_WATER_TANKS_TABLE_NAME,
  STATUS_DEFAULT_OPTION_ID,
  type HotWaterTankRow,
  type HotWaterTanksSlice,
} from "../types";
import { STATUS_FIXTURE_OPTIONS } from "./statusFixtureOptions";

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
    tank_type: "opt_hwt_dhw_heating",
    inside_outside: "opt_hwt_inside",
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    photo_asset_ids: [],
    custom_values: {
      record_id: "HWT-1",
      name: "DHW storage tank",
      quantity: 1,
      manufacturer: "Acme",
      model: "ST-80",
      size_l: 302.8,
      heat_loss_rate_w_k: 1.8,
      status: STATUS_DEFAULT_OPTION_ID,
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
        { id: "opt_hwt_dhw_heating", label: "1-DHW and Heating", color: "#0ea5e9", order: 0 },
        { id: "opt_hwt_dhw_only", label: "2-DHW only", color: "#14b8a6", order: 1 },
      ],
      [HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY]: [
        { id: "opt_hwt_inside", label: "Inside", color: "#0ea5e9", order: 0 },
        { id: "opt_hwt_outside", label: "Outside", color: "#f97316", order: 1 },
      ],
      [HOT_WATER_TANKS_STATUS_OPTION_KEY]: [...STATUS_FIXTURE_OPTIONS],
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
