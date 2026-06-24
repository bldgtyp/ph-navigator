import {
  buildTableSchema,
  setCustomValue,
  tableFieldDefsToFieldDefs,
  useTableSchema,
  type FieldDef,
  type FieldSchemaMutation,
  type TableFieldDef,
  type TableSchema,
} from "../../../shared/ui/data-table";
import {
  FANS_COMPAT_BUILT_IN_FIELD_DEFS,
  fansFieldOverlay,
  PUMPS_COMPAT_BUILT_IN_FIELD_DEFS,
  pumpsFieldOverlay,
  ROOMS_COMPAT_BUILT_IN_FIELD_DEFS,
  roomsFieldOverlay,
  VENTILATORS_COMPAT_BUILT_IN_FIELD_DEFS,
  ventilatorsFieldOverlay,
} from "../lib";
import {
  FAN_TYPE_OPTION_KEY,
  FANS_STATUS_OPTION_KEY,
  FANS_TABLE_NAME,
  PUMP_DEVICE_TYPE_OPTION_KEY,
  PUMPS_STATUS_OPTION_KEY,
  PUMPS_TABLE_NAME,
  ROOMS_TABLE_NAME,
  ROOM_BUILDING_ZONE_OPTION_KEY,
  ROOM_FLOOR_LEVEL_OPTION_KEY,
  STATUS_DEFAULT_OPTION_ID,
  VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
  VENTILATORS_STATUS_OPTION_KEY,
  VENTILATORS_TABLE_NAME,
  type FanRow,
  type FansSlice,
  type PumpRow,
  type PumpsSlice,
  type RoomRow,
  type RoomsSlice,
  type VentilatorRow,
  type VentilatorsSlice,
} from "../types";
import { STATUS_FIXTURE_OPTIONS } from "./statusFixtureOptions";

export { STATUS_FIXTURE_OPTIONS };

const CREATED_AT = "2026-05-25T00:00:00Z";

export * from "./hotWaterHeatersFixtures";
export * from "./hotWaterTanksFixtures";
export * from "./electricHeatersFixtures";
export * from "./appliancesFixtures";

export function tableFieldDef(overrides: Partial<TableFieldDef> = {}): TableFieldDef {
  const fieldKey = overrides.field_key ?? "cf_paint";
  return {
    field_key: fieldKey,
    display_name: "Paint",
    field_type: "short_text",
    config: {},
    description: null,
    origin: "custom",
    created_at: CREATED_AT,
    created_by: null,
    ...overrides,
  };
}

export const roomsBuiltInFieldDefs: TableFieldDef[] = [
  ...ROOMS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function roomsFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...roomsBuiltInFieldDefs, ...customFields];
}

export const pumpsBuiltInFieldDefs: TableFieldDef[] = [
  ...PUMPS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function pumpsFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...pumpsBuiltInFieldDefs, ...customFields];
}

export const ventilatorsBuiltInFieldDefs: TableFieldDef[] = [
  ...VENTILATORS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function ventilatorsFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...ventilatorsBuiltInFieldDefs, ...customFields];
}

export const fansBuiltInFieldDefs: TableFieldDef[] = [
  ...FANS_COMPAT_BUILT_IN_FIELD_DEFS.map(copyTableFieldDef),
];

export function fansFieldDefs(...customFields: TableFieldDef[]): TableFieldDef[] {
  return [...fansBuiltInFieldDefs, ...customFields];
}

export function buildCustomField(overrides: Partial<TableFieldDef> = {}): TableFieldDef {
  return tableFieldDef({
    field_key: "cf_paint",
    display_name: "Paint",
    field_type: "short_text",
    origin: "custom",
    ...overrides,
  });
}

export function buildFormulaField(overrides: Partial<TableFieldDef> = {}): TableFieldDef {
  return buildCustomField({
    field_key: "cf_label",
    display_name: "Label",
    field_type: "formula",
    config: {
      source: 'concat({Number}, " - ", upper({Name}))',
      ast: null,
      deps: ["number", "name"],
      result_type: "text",
    },
    ...overrides,
  });
}

export function buildRoom(overrides: Partial<RoomRow> = {}): RoomRow {
  return {
    id: "rm_1",
    floor_level: "opt_ground",
    building_zone: null,
    icfa_factor: 1,
    catalog_origin: null,
    notes: null,
    custom_values: {
      number: "101",
      name: "Living Room",
      num_people: 0,
      num_bedrooms: 0,
    },
    custom_links: {},
    ...overrides,
  };
}

export function buildPump(overrides: Partial<PumpRow> = {}): PumpRow {
  return {
    id: "pmp_1",
    device_type: "opt_pump_dhw_circulation",
    phase: 1,
    notes: null,
    link: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: "P-1",
      use: "DHW recirc",
      manufacturer: null,
      model: null,
      volts: 120,
      horse_power: null,
      wattage: 45,
      flow_gpm: null,
      runtime_khr_yr: null,
      status: STATUS_DEFAULT_OPTION_ID,
    },
    ...overrides,
  };
}

export function buildVentilator(overrides: Partial<VentilatorRow> = {}): VentilatorRow {
  return {
    id: "vent_1",
    inside_outside: "opt_inside",
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: "ERV-1",
      name: "Apartment ERV",
      airflow_rate_m3h: 425,
      model: "Q350",
      manufacturer: "Zehnder",
      heat_recovery_percent: 84,
      moisture_recovery_percent: 70,
      electrical_efficiency_wh_m3: 0.42,
      filter_merv_rating: 13,
    },
    ...overrides,
  };
}

export function buildFan(overrides: Partial<FanRow> = {}): FanRow {
  return {
    id: "fan_1",
    fan_type: "opt_kitchen_hood",
    phase: 1,
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: "F-1",
      name: "Kitchen hood exhaust",
      quantity: 1,
      model: "KH-100",
      manufacturer: "Acme",
      annual_runtime_min_yr: 12000,
      airflow_m3h: 425,
      amps: 1.2,
      volts: 120,
      power_factor: 0.8,
      watts: 120,
      status: STATUS_DEFAULT_OPTION_ID,
    },
    ...overrides,
  };
}

export function withRoomCustomValues(
  room: RoomRow,
  customValues: Partial<RoomRow["custom_values"]>,
): RoomRow {
  const nextCustomValues = { ...room.custom_values };
  for (const [key, value] of Object.entries(customValues)) {
    if (value !== undefined) nextCustomValues[key] = value;
  }
  return {
    ...room,
    custom_values: nextCustomValues,
  };
}

export type RoomsSchemaMutationFixture = FieldSchemaMutation;

export function applyRoomsSchemaMutationFixture(
  slice: RoomsSlice,
  mutation: RoomsSchemaMutationFixture,
  nextDraftEtag: string,
  options: {
    rowsComputed?: (
      rooms: RoomRow[],
      fieldDefs: TableFieldDef[],
    ) => RoomsSlice["rows_computed"] | undefined;
  } = {},
): RoomsSlice {
  let fieldDefs = slice.field_defs.map(copyTableFieldDef);
  let rooms = slice.rooms;
  switch (mutation.kind) {
    case "addField":
      fieldDefs.push(copyTableFieldDef(mutation.after));
      break;
    case "editFieldBundle":
      fieldDefs = fieldDefs.map((field) =>
        field.field_key === mutation.fieldId ? copyTableFieldDef(mutation.after) : field,
      );
      break;
    case "renameField":
      fieldDefs = fieldDefs.map((field) =>
        field.field_key === mutation.fieldId
          ? { ...field, display_name: mutation.displayName }
          : field,
      );
      break;
    case "duplicateField": {
      const sourceIndex = fieldDefs.findIndex(
        (field) => field.field_key === mutation.sourceFieldId,
      );
      fieldDefs.splice(sourceIndex + 1, 0, copyTableFieldDef(mutation.after));
      break;
    }
    case "setDescription":
      fieldDefs = fieldDefs.map((field) =>
        field.field_key === mutation.fieldId
          ? { ...field, description: mutation.description }
          : field,
      );
      break;
    case "deleteField":
      fieldDefs = fieldDefs.filter((field) => field.field_key !== mutation.fieldId);
      rooms = rooms.map((row) => setCustomValue(row, mutation.fieldId, undefined));
      break;
    case "changeType":
    case "editOptions":
    case "setFormula":
      throw new Error(`Unsupported schema mutation fixture: ${mutation.kind}`);
  }
  return {
    ...slice,
    source: "draft",
    draft_etag: nextDraftEtag,
    field_defs: fieldDefs,
    rooms,
    rows_computed: options.rowsComputed?.(rooms, fieldDefs),
  };
}

function copyTableFieldDef(fieldDef: TableFieldDef): TableFieldDef {
  return { ...fieldDef, config: { ...fieldDef.config } };
}

export function buildRoomsSlice(overrides: Partial<RoomsSlice> = {}): RoomsSlice {
  return {
    project_id: "00000000-0000-0000-0000-000000000001",
    version_id: "00000000-0000-0000-0000-000000000002",
    source: "draft",
    version_etag: "v-etag",
    draft_etag: "d-etag",
    rooms: [],
    field_defs: roomsFieldDefs(),
    single_select_options: {
      [ROOM_FLOOR_LEVEL_OPTION_KEY]: [
        { id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 },
      ],
      [ROOM_BUILDING_ZONE_OPTION_KEY]: [],
    },
    ...overrides,
  };
}

export function buildPumpsSlice(overrides: Partial<PumpsSlice> = {}): PumpsSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    pumps: [],
    field_defs: pumpsFieldDefs(),
    single_select_options: {
      [PUMP_DEVICE_TYPE_OPTION_KEY]: [
        {
          id: "opt_pump_heat_circulation",
          label: "4-Heat Circulation Pump",
          color: "#0ea5e9",
          order: 0,
        },
        {
          id: "opt_pump_dhw_circulation",
          label: "6-DHW Circulation Pump",
          color: "#14b8a6",
          order: 1,
        },
        {
          id: "opt_pump_dhw_storage",
          label: "7-DHW Storage Pump",
          color: "#f97316",
          order: 2,
        },
        { id: "opt_pump_other", label: "10-Other", color: "#64748b", order: 3 },
      ],
      [PUMPS_STATUS_OPTION_KEY]: [...STATUS_FIXTURE_OPTIONS],
    },
    ...overrides,
  };
}

export function buildVentilatorsSlice(overrides: Partial<VentilatorsSlice> = {}): VentilatorsSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    ventilators: [],
    field_defs: ventilatorsFieldDefs(),
    single_select_options: {
      [VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY]: [
        { id: "opt_inside", label: "Inside", color: "#3b82f6", order: 0 },
        { id: "opt_outside", label: "Outside", color: "#10b981", order: 1 },
      ],
      [VENTILATORS_STATUS_OPTION_KEY]: [...STATUS_FIXTURE_OPTIONS],
    },
    ...overrides,
  };
}

export function buildFansSlice(overrides: Partial<FansSlice> = {}): FansSlice {
  return {
    project_id: "proj_1",
    version_id: "ver_1",
    source: "draft",
    version_etag: "v1",
    draft_etag: "d1",
    fans: [],
    field_defs: fansFieldDefs(),
    single_select_options: {
      [FAN_TYPE_OPTION_KEY]: [
        { id: "opt_dryer", label: "1-Dryer", color: "#f97316", order: 0 },
        { id: "opt_kitchen_hood", label: "2-Kitchen Hood", color: "#0ea5e9", order: 1 },
        { id: "opt_user_defined", label: "3-User Defined", color: "#8b5cf6", order: 2 },
      ],
      [FANS_STATUS_OPTION_KEY]: [...STATUS_FIXTURE_OPTIONS],
    },
    ...overrides,
  };
}

export function schemaForRooms(slice: RoomsSlice): TableSchema {
  return buildTableSchema({
    tableKey: ROOMS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: roomsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function schemaForPumps(slice: PumpsSlice): TableSchema {
  return buildTableSchema({
    tableKey: PUMPS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: pumpsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function schemaForVentilators(slice: VentilatorsSlice): TableSchema {
  return buildTableSchema({
    tableKey: VENTILATORS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: ventilatorsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function schemaForFans(slice: FansSlice): TableSchema {
  return buildTableSchema({
    tableKey: FANS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: fansFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function useRoomsTableSchema(slice: RoomsSlice): TableSchema {
  return useTableSchema({
    tableKey: ROOMS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: roomsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function usePumpsTableSchema(slice: PumpsSlice): TableSchema {
  return useTableSchema({
    tableKey: PUMPS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: pumpsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function useVentilatorsTableSchema(slice: VentilatorsSlice): TableSchema {
  return useTableSchema({
    tableKey: VENTILATORS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: ventilatorsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function useFansTableSchema(slice: FansSlice): TableSchema {
  return useTableSchema({
    tableKey: FANS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: fansFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}

export function renderFieldDefsForRooms(slice: RoomsSlice): FieldDef[] {
  return tableFieldDefsToFieldDefs({
    tableKey: ROOMS_TABLE_NAME,
    fieldDefs: slice.field_defs,
    fieldOverlay: roomsFieldOverlay(slice),
    singleSelectOptions: slice.single_select_options,
  });
}
