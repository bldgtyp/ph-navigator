// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
import type {
  ApplianceOptionKey,
  ApplianceRow,
  AppliancesReplacePayload,
  AppliancesSlice,
  CustomValue,
  ElectricHeaterRow,
  ElectricHeatersReplacePayload,
  ElectricHeatersSlice,
  FanOptionKey,
  FanRow,
  FansReplacePayload,
  FansSlice,
  HotWaterHeaterOptionKey,
  HotWaterHeaterRow,
  HotWaterHeatersReplacePayload,
  HotWaterHeatersSlice,
  HotWaterTankOptionKey,
  HotWaterTankRow,
  HotWaterTanksReplacePayload,
  HotWaterTanksSlice,
  PumpOptionKey,
  PumpRow,
  PumpsReplacePayload,
  PumpsSlice,
  RoomOptionKey,
  RoomRow,
  RoomsReplacePayload,
  RoomsSlice,
  SingleSelectOption,
  VentilatorOptionKey,
  VentilatorRow,
  VentilatorsReplacePayload,
  VentilatorsSlice,
} from "./types";
import {
  APPLIANCE_DATASHEET_FIELD_KEY,
  APPLIANCE_ENERGY_STAR_COLUMN_ID,
  APPLIANCE_ENERGY_STAR_KEY,
  APPLIANCE_ENERGY_STAR_OPTION_KEY,
  APPLIANCE_TYPE_COLUMN_ID,
  APPLIANCE_TYPE_KEY,
  APPLIANCE_TYPE_OPTION_KEY,
  FAN_DATASHEET_FIELD_KEY,
  FAN_TYPE_COLUMN_ID,
  FAN_TYPE_KEY,
  FAN_TYPE_OPTION_KEY,
  HOT_WATER_HEATER_DATASHEET_FIELD_KEY,
  HOT_WATER_HEATER_TYPE_COLUMN_ID,
  HOT_WATER_HEATER_TYPE_KEY,
  HOT_WATER_HEATER_TYPE_OPTION_KEY,
  HOT_WATER_TANK_DATASHEET_FIELD_KEY,
  HOT_WATER_TANK_INSIDE_OUTSIDE_KEY,
  HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY,
  HOT_WATER_TANK_TYPE_COLUMN_ID,
  HOT_WATER_TANK_TYPE_KEY,
  HOT_WATER_TANK_TYPE_OPTION_KEY,
  PUMP_DATASHEET_FIELD_KEY,
  PUMP_DEVICE_TYPE_COLUMN_ID,
  PUMP_DEVICE_TYPE_KEY,
  PUMP_DEVICE_TYPE_OPTION_KEY,
  ROOM_BUILDING_ZONE_COLUMN_ID,
  ROOM_BUILDING_ZONE_KEY,
  ROOM_BUILDING_ZONE_OPTION_KEY,
  ROOM_FLOOR_LEVEL_COLUMN_ID,
  ROOM_FLOOR_LEVEL_KEY,
  ROOM_FLOOR_LEVEL_OPTION_KEY,
  ROOM_SPACE_TYPE_FIELD_KEY,
  ROOMS_TABLE_NAME,
  VENTILATOR_INSIDE_OUTSIDE_COLUMN_ID,
  VENTILATOR_INSIDE_OUTSIDE_KEY,
  VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY,
} from "./types";
import type {
  BuildEmptyRow,
  DataTableColumnDef,
  FieldDef,
  FieldOption,
  RowDeletePayload,
  RowDuplicatePayload,
  RowInsertPayload,
  TableFieldRenderOverlay,
  TableFieldDef,
} from "../../shared/ui/data-table";
import type { NumberUnitsConfig } from "../../lib/units";
import {
  ALL_FIELD_LOCKS,
  DEFAULT_BUILT_IN_LOCKS,
  isCustomFieldKey,
  setCustomLink,
  setCustomValue,
} from "../../shared/ui/data-table";
import {
  createFieldOption,
  findFieldOptionByLabel,
  formatDisplayCellValue,
  normalizeOptionOrders,
} from "../../shared/ui/data-table/lib";
import { generatedId } from "../../shared/lib/ids";
import { readAttachmentAssetIds } from "../assets/lib";
import {
  customNumberValue,
  customTextValue,
  customTextValueOrNull,
} from "./lib/customValueReaders";
import { nextCopySuffix } from "../../shared/lib/copySuffix";
export { nextCopySuffix } from "../../shared/lib/copySuffix";
export {
  isDraftStaleError,
  isInvalidProjectDocumentError,
  isVersionLockedError,
  wasLocalDraftTouched,
} from "../project_document/lib";

// Feature-scoped ID prefix for `generatedId`. Centralized so future
// tabs (ERV, Pumps, Fans, TB) can't pick a colliding short prefix and
// so a single grep tells you where Room IDs are minted.
export const ROOM_ID_PREFIX = "rm";
export const PUMP_ID_PREFIX = "pmp";
export const VENTILATOR_ID_PREFIX = "vent";
export const FAN_ID_PREFIX = "fan";
export const HOT_WATER_HEATER_ID_PREFIX = "hwh";
export const HOT_WATER_TANK_ID_PREFIX = "hwt";
export const ELECTRIC_HEATER_ID_PREFIX = "heatr";
export const APPLIANCE_ID_PREFIX = "appl";

const PUMP_FLOW_LEGACY_DISPLAY_NAME = "Flow - GPM";
export const PUMP_FLOW_RATE_UNITS: NumberUnitsConfig = {
  mode: "fixed",
  unit_type: "flow_rate",
  si_unit: "l_min",
  ip_unit: "gpm",
  precision_si: 1,
  precision_ip: 1,
};
export const APPLIANCE_ANNUAL_ENERGY_UNITS: NumberUnitsConfig = {
  mode: "fixed",
  unit_type: "energy",
  si_unit: "kwh",
  ip_unit: "kbtu",
  precision_si: 0,
  precision_ip: 0,
};

type RoomCellWrite = { rowId: string; fieldKey: string; value: unknown };
type ApplianceCellWrite = { rowId: string; fieldKey: string; value: unknown };
type PumpCellWrite = { rowId: string; fieldKey: string; value: unknown };
type VentilatorCellWrite = { rowId: string; fieldKey: string; value: unknown };
type FanCellWrite = { rowId: string; fieldKey: string; value: unknown };
type HotWaterHeaterCellWrite = { rowId: string; fieldKey: string; value: unknown };
type HotWaterTankCellWrite = { rowId: string; fieldKey: string; value: unknown };
type ElectricHeaterCellWrite = { rowId: string; fieldKey: string; value: unknown };

// Namespace prefix for custom single-select option lists scoped to the
// Rooms table. Mirrors backend `option_list_key((ROOMS_TABLE_NAME,), cf_id)`.
const ROOMS_CUSTOM_OPTION_PREFIX = "rooms.cf_";

export const ROOMS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  "floor_level",
  "building_zone",
  "icfa_factor",
  "catalog_origin",
  "notes",
  "custom_values",
  "custom_links",
] as const;

export const PUMPS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  "device_type",
  "phase",
  "notes",
  "link",
  PUMP_DATASHEET_FIELD_KEY,
  "custom_values",
] as const;

export const VENTILATORS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  VENTILATOR_INSIDE_OUTSIDE_KEY,
  "url",
  "notes",
  "custom_values",
] as const;

export const FANS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  FAN_TYPE_KEY,
  "phase",
  "url",
  "notes",
  FAN_DATASHEET_FIELD_KEY,
  "custom_values",
] as const;

export const HOT_WATER_HEATERS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  HOT_WATER_HEATER_TYPE_KEY,
  "phase",
  "url",
  "notes",
  HOT_WATER_HEATER_DATASHEET_FIELD_KEY,
  "custom_values",
] as const;

export const HOT_WATER_TANKS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  HOT_WATER_TANK_TYPE_KEY,
  HOT_WATER_TANK_INSIDE_OUTSIDE_KEY,
  "url",
  "notes",
  HOT_WATER_TANK_DATASHEET_FIELD_KEY,
  "custom_values",
] as const;

export const ELECTRIC_HEATERS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  "url",
  "notes",
  "custom_values",
] as const;

export const APPLIANCES_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  APPLIANCE_TYPE_KEY,
  APPLIANCE_ENERGY_STAR_KEY,
  "url",
  "notes",
  APPLIANCE_DATASHEET_FIELD_KEY,
  "custom_values",
] as const;

const ROOM_CUSTOM_VALUE_FIELD_KEYS = new Set(["number", "name", "num_people", "num_bedrooms"]);
const PUMP_CUSTOM_VALUE_FIELD_KEYS = new Set([
  "record_id",
  "use",
  "manufacturer",
  "model",
  "volts",
  "horse_power",
  "wattage",
  "flow_gpm",
  "runtime_khr_yr",
]);
const VENTILATOR_CUSTOM_VALUE_FIELD_KEYS = new Set([
  "record_id",
  "name",
  "airflow_rate_m3h",
  "model",
  "manufacturer",
  "heat_recovery_percent",
  "moisture_recovery_percent",
  "electrical_efficiency_wh_m3",
  "filter_merv_rating",
]);
const FAN_CUSTOM_VALUE_FIELD_KEYS = new Set([
  "record_id",
  "name",
  "quantity",
  "model",
  "manufacturer",
  "annual_runtime_min_yr",
  "airflow_m3h",
  "amps",
  "volts",
  "power_factor",
  "watts",
]);
const HOT_WATER_HEATER_CUSTOM_VALUE_FIELD_KEYS = new Set([
  "record_id",
  "name",
  "quantity",
  "model",
  "manufacturer",
  "size_l",
  "temperature_c",
  "amps",
  "volts",
  "power_factor",
  "watts",
  "uef",
]);
const HOT_WATER_TANK_CUSTOM_VALUE_FIELD_KEYS = new Set([
  "record_id",
  "name",
  "quantity",
  "manufacturer",
  "model",
  "size_l",
  "heat_loss_rate_w_k",
]);
const ELECTRIC_HEATER_CUSTOM_VALUE_FIELD_KEYS = new Set([
  "record_id",
  "name",
  "model",
  "manufacturer",
  "watt",
]);
const APPLIANCE_CUSTOM_VALUE_FIELD_KEYS = new Set([
  "record_id",
  "name",
  "quantity",
  "model",
  "manufacturer",
  "capacity_m3",
  "cef",
  "imef",
  "mef",
  "annual_energy_kwh",
]);

const BUILT_IN_FIELD_CREATED_AT = "2026-05-26T00:00:00Z";

function builtInFieldDef(
  field_key: string,
  display_name: string,
  field_type: TableFieldDef["field_type"],
  defaultValue?: CustomValue,
): TableFieldDef {
  return {
    field_key,
    display_name,
    field_type,
    config: {},
    description: null,
    default: defaultValue,
    origin: "built_in",
    created_at: BUILT_IN_FIELD_CREATED_AT,
    created_by: null,
  };
}

export const ROOMS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Display Name", "formula"),
  builtInFieldDef("number", "Number", "short_text"),
  builtInFieldDef("name", "Name", "short_text"),
  builtInFieldDef(ROOM_FLOOR_LEVEL_KEY, "Floor", "single_select"),
  builtInFieldDef(ROOM_BUILDING_ZONE_KEY, "Zone", "single_select"),
  {
    ...builtInFieldDef(ROOM_SPACE_TYPE_FIELD_KEY, "Space Type", "linked_record"),
    config: { target_table_path: ["space_types"], max_links: 1 },
  },
  builtInFieldDef("num_people", "People", "number"),
  builtInFieldDef("num_bedrooms", "Bedrooms", "number"),
  builtInFieldDef("icfa_factor", "iCFA", "number"),
];

export const PUMPS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Tag", "short_text"),
  builtInFieldDef("name", "Display Name", "short_text"),
  builtInFieldDef(PUMP_DEVICE_TYPE_KEY, "Device", "single_select"),
  builtInFieldDef("use", "Use", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef("model", "Model", "short_text"),
  builtInFieldDef("volts", "Volts", "number"),
  builtInFieldDef("phase", "Phase", "number"),
  builtInFieldDef("horse_power", "Horse Power", "number"),
  builtInFieldDef("wattage", "Wattage", "number"),
  {
    ...builtInFieldDef("flow_gpm", "Flow", "number"),
    config: {
      units: PUMP_FLOW_RATE_UNITS,
    },
  },
  builtInFieldDef("runtime_khr_yr", "Runtime - kHR/YEAR", "number"),
  builtInFieldDef("link", "Link", "url"),
  builtInFieldDef("notes", "Notes", "long_text"),
  builtInFieldDef(PUMP_DATASHEET_FIELD_KEY, "Datasheet", "long_text"),
];

export const VENTILATORS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Tag", "short_text"),
  builtInFieldDef("name", "Display Name", "short_text"),
  {
    ...builtInFieldDef("airflow_rate_m3h", "Airflow Rate", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "airflow",
        si_unit: "m3_h",
        ip_unit: "cfm",
        precision_si: 1,
        precision_ip: 1,
      },
    },
  },
  builtInFieldDef("model", "Model", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef("heat_recovery_percent", "Heat Recovery %", "number"),
  builtInFieldDef("moisture_recovery_percent", "Moisture Recovery %", "number"),
  {
    ...builtInFieldDef("electrical_efficiency_wh_m3", "Electrical Efficiency", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "electric_efficiency",
        si_unit: "wh_m3",
        ip_unit: "w_cfm",
        precision_si: 2,
        precision_ip: 2,
      },
    },
  },
  builtInFieldDef("filter_merv_rating", "Filter MERV Rating", "number"),
  builtInFieldDef(VENTILATOR_INSIDE_OUTSIDE_KEY, "Inside / Outside", "single_select"),
  builtInFieldDef("url", "URL", "url"),
  builtInFieldDef("notes", "Notes", "long_text"),
];

export const FANS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Tag", "short_text"),
  builtInFieldDef("name", "Display Name", "short_text"),
  builtInFieldDef("quantity", "Quantity", "number", 1),
  builtInFieldDef(FAN_TYPE_KEY, "Type", "single_select"),
  builtInFieldDef("model", "Model", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef("annual_runtime_min_yr", "Annual Runtime (Mins / Year)", "number"),
  {
    ...builtInFieldDef("airflow_m3h", "Airflow", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "airflow",
        si_unit: "m3_h",
        ip_unit: "cfm",
        precision_si: 1,
        precision_ip: 1,
      },
    },
  },
  builtInFieldDef("amps", "Amps", "number"),
  builtInFieldDef("volts", "Volts", "number"),
  builtInFieldDef("phase", "Phase", "number"),
  builtInFieldDef("power_factor", "Power Factor", "number", 0.8),
  builtInFieldDef("watts", "Watts", "number"),
  builtInFieldDef("url", "URL", "url"),
  builtInFieldDef("notes", "Notes", "long_text"),
  builtInFieldDef(FAN_DATASHEET_FIELD_KEY, "Datasheet", "long_text"),
];

export const HOT_WATER_HEATERS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Tag", "short_text"),
  builtInFieldDef("name", "Display Name", "short_text"),
  builtInFieldDef("quantity", "Quantity", "number", 1),
  builtInFieldDef(HOT_WATER_HEATER_TYPE_KEY, "Type", "single_select"),
  builtInFieldDef("model", "Model", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  {
    ...builtInFieldDef("size_l", "Size", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "volume_liters",
        si_unit: "l",
        ip_unit: "gal",
        precision_si: 1,
        precision_ip: 1,
      },
    },
  },
  {
    ...builtInFieldDef("temperature_c", "Temperature", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "temperature",
        si_unit: "c",
        ip_unit: "f",
        precision_si: 1,
        precision_ip: 1,
      },
    },
  },
  builtInFieldDef("amps", "Amps", "number"),
  builtInFieldDef("volts", "Volts", "number"),
  builtInFieldDef("phase", "Phase", "number"),
  builtInFieldDef("power_factor", "Power Factor", "number", 0.8),
  builtInFieldDef("watts", "Watts", "number"),
  builtInFieldDef("uef", "UEF", "number"),
  builtInFieldDef("url", "URL", "url"),
  builtInFieldDef("notes", "Notes", "long_text"),
  builtInFieldDef(HOT_WATER_HEATER_DATASHEET_FIELD_KEY, "Datasheet", "long_text"),
];

export const HOT_WATER_TANKS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Tag", "short_text"),
  builtInFieldDef("name", "Display Name", "short_text"),
  builtInFieldDef("quantity", "Quantity", "number", 1),
  builtInFieldDef(HOT_WATER_TANK_TYPE_KEY, "Type", "single_select"),
  builtInFieldDef(HOT_WATER_TANK_INSIDE_OUTSIDE_KEY, "Inside / Outside", "single_select"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef("model", "Model", "short_text"),
  {
    ...builtInFieldDef("size_l", "Size", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "volume_liters",
        si_unit: "l",
        ip_unit: "gal",
        precision_si: 1,
        precision_ip: 1,
      },
    },
  },
  {
    ...builtInFieldDef("heat_loss_rate_w_k", "Heat Loss Rate", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "heat_loss_rate",
        si_unit: "w_k",
        ip_unit: "btu_h_f",
        precision_si: 1,
        precision_ip: 1,
      },
    },
  },
  builtInFieldDef(HOT_WATER_TANK_DATASHEET_FIELD_KEY, "Datasheet", "long_text"),
  builtInFieldDef("url", "URL", "url"),
  builtInFieldDef("notes", "Notes", "long_text"),
];

export const ELECTRIC_HEATERS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Tag", "short_text"),
  builtInFieldDef("name", "Display Name", "short_text"),
  builtInFieldDef("model", "Model", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef("watt", "Watt", "number"),
  builtInFieldDef("url", "URL", "url"),
  builtInFieldDef("notes", "Notes", "long_text"),
];

export const APPLIANCES_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Tag", "short_text"),
  builtInFieldDef(APPLIANCE_TYPE_KEY, "Type", "single_select"),
  builtInFieldDef("name", "Display Name", "short_text"),
  builtInFieldDef("quantity", "Quantity", "number", 1),
  builtInFieldDef("model", "Model", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef(APPLIANCE_ENERGY_STAR_KEY, "EnergyStar", "single_select"),
  {
    ...builtInFieldDef("capacity_m3", "Capacity", "number"),
    config: {
      units: {
        mode: "fixed",
        unit_type: "volume",
        si_unit: "m3",
        ip_unit: "ft3",
        precision_si: 3,
        precision_ip: 1,
      },
    },
  },
  builtInFieldDef("cef", "CEF", "number"),
  builtInFieldDef("imef", "IMEF", "number"),
  builtInFieldDef("mef", "MEF", "number"),
  {
    ...builtInFieldDef("annual_energy_kwh", "Annual Energy", "number"),
    config: {
      units: APPLIANCE_ANNUAL_ENERGY_UNITS,
    },
  },
  builtInFieldDef("url", "URL", "url"),
  builtInFieldDef(APPLIANCE_DATASHEET_FIELD_KEY, "Datasheet", "long_text"),
  builtInFieldDef("notes", "Notes", "long_text"),
];

export function roomsFieldOverlay(roomsSlice: RoomsSlice): Record<string, TableFieldRenderOverlay> {
  return {
    record_id: {
      locked: ["display_name", "delete", "duplicate"],
    },
    number: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [ROOM_FLOOR_LEVEL_KEY]: {
      options: roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    [ROOM_BUILDING_ZONE_KEY]: {
      options: roomsSlice.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    [ROOM_SPACE_TYPE_FIELD_KEY]: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    num_people: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    num_bedrooms: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    icfa_factor: {
      // icfa_factor ∈ [0, 1] — domain invariant doesn't survive a retype.
      locked: ["field_type", "delete", "duplicate"],
    },
  };
}

export function roomsTableFieldDefs(roomsSlice: RoomsSlice): TableFieldDef[] {
  return roomsSlice.field_defs ?? ROOMS_COMPAT_BUILT_IN_FIELD_DEFS;
}

export function pumpsTableFieldDefs(pumpsSlice: PumpsSlice): TableFieldDef[] {
  return pumpsSlice.field_defs ?? PUMPS_COMPAT_BUILT_IN_FIELD_DEFS;
}

export function ventilatorsTableFieldDefs(ventilatorsSlice: VentilatorsSlice): TableFieldDef[] {
  return ventilatorsSlice.field_defs ?? VENTILATORS_COMPAT_BUILT_IN_FIELD_DEFS;
}

export function fansTableFieldDefs(fansSlice: FansSlice): TableFieldDef[] {
  return fansSlice.field_defs ?? FANS_COMPAT_BUILT_IN_FIELD_DEFS;
}

export function hotWaterHeatersTableFieldDefs(
  hotWaterHeatersSlice: HotWaterHeatersSlice,
): TableFieldDef[] {
  return hotWaterHeatersSlice.field_defs ?? HOT_WATER_HEATERS_COMPAT_BUILT_IN_FIELD_DEFS;
}

export function hotWaterTanksTableFieldDefs(
  hotWaterTanksSlice: HotWaterTanksSlice,
): TableFieldDef[] {
  return hotWaterTanksSlice.field_defs ?? HOT_WATER_TANKS_COMPAT_BUILT_IN_FIELD_DEFS;
}

export function electricHeatersTableFieldDefs(
  electricHeatersSlice: ElectricHeatersSlice,
): TableFieldDef[] {
  return electricHeatersSlice.field_defs ?? ELECTRIC_HEATERS_COMPAT_BUILT_IN_FIELD_DEFS;
}

export function appliancesTableFieldDefs(appliancesSlice: AppliancesSlice): TableFieldDef[] {
  return appliancesSlice.field_defs ?? APPLIANCES_COMPAT_BUILT_IN_FIELD_DEFS;
}

// Stub columns for sanitization — sanitizer reads only `id` + `fieldKey`.
// The real columns (with `render`, accessors, widths) live in
// RoomsTable.tsx; ids here must match those there, or
// sanitizeViewStateForSchema would silently drop entries from
// view.columnOrder / view.hiddenColumns and the user's drag-reorder
// would not survive a render.
const ROOMS_COLUMN_ID_BY_FIELD_KEY: Record<string, string> = {
  [ROOM_FLOOR_LEVEL_KEY]: ROOM_FLOOR_LEVEL_COLUMN_ID,
  [ROOM_BUILDING_ZONE_KEY]: ROOM_BUILDING_ZONE_COLUMN_ID,
};

export function roomsTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id: ROOMS_COLUMN_ID_BY_FIELD_KEY[fieldDef.field_key] ?? fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

export function pumpsFieldOverlay(pumpsSlice: PumpsSlice): Record<string, TableFieldRenderOverlay> {
  const flowField = pumpsTableFieldDefs(pumpsSlice).find((field) => field.field_key === "flow_gpm");
  return {
    record_id: {
      locked: ["display_name", "delete", "duplicate"],
    },
    [PUMP_DEVICE_TYPE_KEY]: {
      options: pumpsSlice.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    use: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    manufacturer: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    model: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    volts: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    phase: {
      // phase ∈ {1, 3} — row validator enforces it; doesn't survive retype.
      locked: ["field_type", "delete", "duplicate"],
    },
    horse_power: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    wattage: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    flow_gpm: {
      locked: DEFAULT_BUILT_IN_LOCKS,
      numberUnits: PUMP_FLOW_RATE_UNITS,
      ...(flowField?.display_name === PUMP_FLOW_LEGACY_DISPLAY_NAME
        ? { display_name: "Flow" }
        : {}),
    },
    runtime_khr_yr: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    link: {
      // URL validator runs at the cell-write boundary; retype would lose it.
      locked: ["field_type", "delete", "duplicate"],
    },
    [PUMP_DATASHEET_FIELD_KEY]: {
      locked: ALL_FIELD_LOCKS,
    },
  };
}

export function pumpsTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id:
      fieldDef.field_key === PUMP_DEVICE_TYPE_KEY ? PUMP_DEVICE_TYPE_COLUMN_ID : fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

export function ventilatorsFieldOverlay(
  ventilatorsSlice: VentilatorsSlice,
): Record<string, TableFieldRenderOverlay> {
  return {
    record_id: {
      locked: ["display_name", "delete", "duplicate"],
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    airflow_rate_m3h: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    model: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    manufacturer: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    heat_recovery_percent: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    moisture_recovery_percent: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    electrical_efficiency_wh_m3: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    filter_merv_rating: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [VENTILATOR_INSIDE_OUTSIDE_KEY]: {
      options: ventilatorsSlice.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    url: {
      locked: ["field_type", "delete", "duplicate"],
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
  };
}

export function ventilatorsTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id:
      fieldDef.field_key === VENTILATOR_INSIDE_OUTSIDE_KEY
        ? VENTILATOR_INSIDE_OUTSIDE_COLUMN_ID
        : fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

export function fansFieldOverlay(fansSlice: FansSlice): Record<string, TableFieldRenderOverlay> {
  return {
    record_id: {
      locked: ["display_name", "delete", "duplicate"],
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    quantity: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [FAN_TYPE_KEY]: {
      options: fansSlice.single_select_options[FAN_TYPE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    model: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    manufacturer: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    annual_runtime_min_yr: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    airflow_m3h: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    amps: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    volts: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    phase: {
      locked: ["field_type", "delete", "duplicate"],
    },
    power_factor: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    watts: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    url: {
      locked: ["field_type", "delete", "duplicate"],
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [FAN_DATASHEET_FIELD_KEY]: {
      locked: ALL_FIELD_LOCKS,
    },
  };
}

export function fansTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id: fieldDef.field_key === FAN_TYPE_KEY ? FAN_TYPE_COLUMN_ID : fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

export function hotWaterHeatersFieldOverlay(
  hotWaterHeatersSlice: HotWaterHeatersSlice,
): Record<string, TableFieldRenderOverlay> {
  return {
    record_id: {
      locked: ["display_name", "delete", "duplicate"],
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    quantity: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [HOT_WATER_HEATER_TYPE_KEY]: {
      options: hotWaterHeatersSlice.single_select_options[HOT_WATER_HEATER_TYPE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    model: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    manufacturer: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    size_l: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    temperature_c: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    amps: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    volts: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    phase: {
      locked: ["field_type", "delete", "duplicate"],
    },
    power_factor: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    watts: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    uef: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    url: {
      locked: ["field_type", "delete", "duplicate"],
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [HOT_WATER_HEATER_DATASHEET_FIELD_KEY]: {
      locked: ALL_FIELD_LOCKS,
    },
  };
}

export function hotWaterHeatersTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id:
      fieldDef.field_key === HOT_WATER_HEATER_TYPE_KEY
        ? HOT_WATER_HEATER_TYPE_COLUMN_ID
        : fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

export function hotWaterTanksFieldOverlay(
  hotWaterTanksSlice: HotWaterTanksSlice,
): Record<string, TableFieldRenderOverlay> {
  return {
    record_id: {
      locked: ["display_name", "delete", "duplicate"],
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    quantity: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [HOT_WATER_TANK_TYPE_KEY]: {
      options: hotWaterTanksSlice.single_select_options[HOT_WATER_TANK_TYPE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    [HOT_WATER_TANK_INSIDE_OUTSIDE_KEY]: {
      options: hotWaterTanksSlice.single_select_options[HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    manufacturer: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    model: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    size_l: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    heat_loss_rate_w_k: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [HOT_WATER_TANK_DATASHEET_FIELD_KEY]: {
      locked: ALL_FIELD_LOCKS,
    },
    url: {
      locked: ["field_type", "delete", "duplicate"],
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
  };
}

export function hotWaterTanksTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id:
      fieldDef.field_key === HOT_WATER_TANK_TYPE_KEY
        ? HOT_WATER_TANK_TYPE_COLUMN_ID
        : fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

export function electricHeatersFieldOverlay(): Record<string, TableFieldRenderOverlay> {
  return {
    record_id: {
      locked: ["display_name", "delete", "duplicate"],
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    model: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    manufacturer: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    watt: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    url: {
      locked: ["field_type", "delete", "duplicate"],
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
  };
}

export function electricHeatersTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id: fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

export function appliancesFieldOverlay(
  appliancesSlice: AppliancesSlice,
): Record<string, TableFieldRenderOverlay> {
  return {
    record_id: {
      locked: ["display_name", "delete", "duplicate"],
    },
    [APPLIANCE_TYPE_KEY]: {
      options: appliancesSlice.single_select_options[APPLIANCE_TYPE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    quantity: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    model: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    manufacturer: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [APPLIANCE_ENERGY_STAR_KEY]: {
      options: appliancesSlice.single_select_options[APPLIANCE_ENERGY_STAR_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    capacity_m3: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    cef: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    imef: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    mef: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    annual_energy_kwh: {
      locked: DEFAULT_BUILT_IN_LOCKS,
      numberUnits: APPLIANCE_ANNUAL_ENERGY_UNITS,
    },
    url: {
      locked: ["field_type", "delete", "duplicate"],
    },
    [APPLIANCE_DATASHEET_FIELD_KEY]: {
      locked: ALL_FIELD_LOCKS,
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
  };
}

export function appliancesTableColumnsForSanitize(
  fieldDefs: readonly FieldDef[],
): DataTableColumnDef<unknown>[] {
  return fieldDefs.map((fieldDef) => ({
    id:
      fieldDef.field_key === APPLIANCE_TYPE_KEY
        ? APPLIANCE_TYPE_COLUMN_ID
        : fieldDef.field_key === APPLIANCE_ENERGY_STAR_KEY
          ? APPLIANCE_ENERGY_STAR_COLUMN_ID
          : fieldDef.field_key,
    fieldKey: fieldDef.field_key,
    header: fieldDef.display_name,
    accessor: () => null,
  }));
}

export function emptyPump(): PumpRow {
  return {
    id: generatedId(PUMP_ID_PREFIX),
    device_type: null,
    phase: null,
    notes: null,
    link: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: null,
      use: null,
      manufacturer: null,
      model: null,
      volts: null,
      horse_power: null,
      wattage: null,
      flow_gpm: null,
      runtime_khr_yr: null,
    },
  };
}

export function emptyVentilator(): VentilatorRow {
  return {
    id: generatedId(VENTILATOR_ID_PREFIX),
    inside_outside: null,
    url: null,
    notes: null,
    custom_values: {
      record_id: null,
      name: null,
      airflow_rate_m3h: null,
      model: null,
      manufacturer: null,
      heat_recovery_percent: null,
      moisture_recovery_percent: null,
      electrical_efficiency_wh_m3: null,
      filter_merv_rating: null,
    },
  };
}

export function emptyFan(): FanRow {
  return {
    id: generatedId(FAN_ID_PREFIX),
    fan_type: null,
    phase: null,
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: null,
      name: null,
      quantity: 1,
      model: null,
      manufacturer: null,
      annual_runtime_min_yr: null,
      airflow_m3h: null,
      amps: null,
      volts: null,
      power_factor: 0.8,
      watts: null,
    },
  };
}

export function emptyHotWaterHeater(): HotWaterHeaterRow {
  return {
    id: generatedId(HOT_WATER_HEATER_ID_PREFIX),
    heater_type: null,
    phase: null,
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: null,
      name: null,
      quantity: 1,
      model: null,
      manufacturer: null,
      size_l: null,
      temperature_c: null,
      amps: null,
      volts: null,
      power_factor: 0.8,
      watts: null,
      uef: null,
    },
  };
}

export function emptyHotWaterTank(): HotWaterTankRow {
  return {
    id: generatedId(HOT_WATER_TANK_ID_PREFIX),
    tank_type: null,
    inside_outside: null,
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: null,
      name: null,
      quantity: 1,
      manufacturer: null,
      model: null,
      size_l: null,
      heat_loss_rate_w_k: null,
    },
  };
}

export function emptyElectricHeater(): ElectricHeaterRow {
  return {
    id: generatedId(ELECTRIC_HEATER_ID_PREFIX),
    url: null,
    notes: null,
    custom_values: {
      record_id: null,
      name: null,
      model: null,
      manufacturer: null,
      watt: null,
    },
  };
}

export function emptyAppliance(): ApplianceRow {
  return {
    id: generatedId(APPLIANCE_ID_PREFIX),
    appliance_type: null,
    energy_star: null,
    url: null,
    notes: null,
    datasheet_asset_ids: [],
    custom_values: {
      record_id: null,
      name: null,
      quantity: 1,
      model: null,
      manufacturer: null,
      capacity_m3: null,
      cef: null,
      imef: null,
      mef: null,
      annual_energy_kwh: null,
    },
  };
}

export function emptyRoom(defaultFloorLevel: string | null = null): RoomRow {
  return {
    id: generatedId(ROOM_ID_PREFIX),
    floor_level: defaultFloorLevel,
    building_zone: null,
    icfa_factor: 1,
    catalog_origin: null,
    notes: null,
    custom_values: {
      number: "",
      name: "",
      num_people: 0,
      num_bedrooms: 0,
    },
    custom_links: {},
  };
}

export function optionLabel(options: SingleSelectOption[], optionId: string | null): string {
  return formatDisplayCellValue(optionId, {
    field_key: "single_select_option",
    field_type: "single_select",
    display_name: "Single select option",
    options,
  });
}

export function sortedPumps(pumps: PumpRow[]): PumpRow[] {
  return pumps
    .map((pump) => ({
      pump,
      primary: customTextValue(pump, "record_id") || customTextValue(pump, "use") || pump.id,
    }))
    .sort((a, b) => {
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.pump.id.localeCompare(b.pump.id, undefined, { numeric: true, sensitivity: "base" });
    })
    .map(({ pump }) => pump);
}

export function sortedVentilators(ventilators: VentilatorRow[]): VentilatorRow[] {
  return ventilators
    .map((ventilator) => ({
      ventilator,
      primary:
        customTextValue(ventilator, "record_id") ||
        customTextValue(ventilator, "name") ||
        ventilator.id,
    }))
    .sort((a, b) => {
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.ventilator.id.localeCompare(b.ventilator.id, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map(({ ventilator }) => ventilator);
}

export function sortedFans(fans: FanRow[]): FanRow[] {
  return fans
    .map((fan) => ({
      fan,
      primary: customTextValue(fan, "record_id") || customTextValue(fan, "name") || fan.id,
    }))
    .sort((a, b) => {
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.fan.id.localeCompare(b.fan.id, undefined, { numeric: true, sensitivity: "base" });
    })
    .map(({ fan }) => fan);
}

export function sortedHotWaterHeaters(hotWaterHeaters: HotWaterHeaterRow[]): HotWaterHeaterRow[] {
  return hotWaterHeaters
    .map((heater) => ({
      heater,
      primary: customTextValue(heater, "record_id") || customTextValue(heater, "name") || heater.id,
    }))
    .sort((a, b) => {
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.heater.id.localeCompare(b.heater.id, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map(({ heater }) => heater);
}

export function sortedHotWaterTanks(hotWaterTanks: HotWaterTankRow[]): HotWaterTankRow[] {
  return hotWaterTanks
    .map((tank) => ({
      tank,
      primary: customTextValue(tank, "record_id") || customTextValue(tank, "name") || tank.id,
    }))
    .sort((a, b) => {
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.tank.id.localeCompare(b.tank.id, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map(({ tank }) => tank);
}

export function sortedElectricHeaters(electricHeaters: ElectricHeaterRow[]): ElectricHeaterRow[] {
  return electricHeaters
    .map((heater) => ({
      heater,
      primary: customTextValue(heater, "record_id") || customTextValue(heater, "name") || heater.id,
    }))
    .sort((a, b) => {
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.heater.id.localeCompare(b.heater.id, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map(({ heater }) => heater);
}

export function sortedAppliances(appliances: ApplianceRow[]): ApplianceRow[] {
  return appliances
    .map((appliance) => ({
      appliance,
      primary:
        customTextValue(appliance, "record_id") ||
        customTextValue(appliance, "name") ||
        appliance.id,
    }))
    .sort((a, b) => {
      const primary = a.primary.localeCompare(b.primary, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (primary !== 0) return primary;
      return a.appliance.id.localeCompare(b.appliance.id, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    })
    .map(({ appliance }) => appliance);
}

export function firstRoomFloorOptionId(current: RoomsSlice): string | null {
  return (
    [...current.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]].sort(
      (a, b) => a.order - b.order,
    )[0]?.id ?? null
  );
}

export function nextRoomsPayload(
  current: RoomsSlice,
  room: RoomRow,
  labels: { floorLevel: string; buildingZone: string },
): RoomsReplacePayload {
  const options = cloneOptions(current);
  const floorLevel = upsertOption(options, ROOM_FLOOR_LEVEL_OPTION_KEY, labels.floorLevel);
  const buildingZone = upsertOption(options, ROOM_BUILDING_ZONE_OPTION_KEY, labels.buildingZone);
  const normalizedRoom = normalizeRoomForPayload(
    {
      ...room,
      floor_level: floorLevel,
      building_zone: buildingZone,
    },
    current.field_defs,
  );
  const existingIndex = current.rooms.findIndex((candidate) => candidate.id === normalizedRoom.id);
  const rooms =
    existingIndex === -1
      ? [...current.rooms, normalizedRoom]
      : current.rooms.map((candidate, index) =>
          index === existingIndex ? normalizedRoom : candidate,
        );
  return {
    rooms,
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function deleteRoomPayload(current: RoomsSlice, roomId: string): RoomsReplacePayload {
  return {
    rooms: current.rooms.filter((room) => room.id !== roomId),
    single_select_options: cloneOptions(current),
    field_defs: [...current.field_defs],
  };
}

// Build a RoomsReplacePayload that adds the rows synthesized by the
// <DataTable> Shift+Enter gesture. The consumer's buildEmptyRow has
// already expanded fieldDefaults into a full RoomRow — this helper
// inserts each row below its anchor and clones options unchanged.
export function roomsPayloadFromRowInsert(
  current: RoomsSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<RoomRow>,
): RoomsReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.rooms.find((room) => room.id === payload.anchorRowId) ?? null)
      : null;
    return build({
      rowId: payload.rowId,
      fieldDefaults: payload.fieldDefaults,
      anchorRow,
    });
  });
  const builtById = new Set(built.map((room) => room.id));
  const rooms = current.rooms.filter((room) => !builtById.has(room.id));
  for (const [index, room] of built.entries()) {
    const anchorRowId = inserts[index]?.anchorRowId ?? null;
    const anchorIndex = anchorRowId
      ? rooms.findIndex((candidate) => candidate.id === anchorRowId)
      : -1;
    const insertAt = anchorIndex === -1 ? rooms.length : anchorIndex + 1;
    rooms.splice(insertAt, 0, normalizeRoomForPayload(room, current.field_defs));
  }
  return {
    rooms,
    single_select_options: cloneOptions(current),
    field_defs: [...current.field_defs],
  };
}

// Slice-replace duplicate for Rooms. The library's WriteOp carries the
// full source TRow snapshot per PRD §6; we clone it client-side, mint a
// fresh `(copy)` suffix on the built-in `name` field (stored under
// `custom_values["name"]` per the Rooms data model), splice below the
// anchor row, and dispatch through the existing slice-replace PUT
// path. `liveNames` accumulates across the duplicates array so a
// batched multi-row duplicate picks distinct suffixes.
// Built-in `name` / `record_id` fields live inside `custom_values`
// alongside `cf_*` entries. Reading them returns the empty string when
// missing so the suffix resolver still produces `(copy)` rather than
// crashing on an undefined source name.
function stringFromCustomValues(values: Record<string, CustomValue>, key: string): string {
  const raw = values[key];
  return typeof raw === "string" ? raw : "";
}

export function roomsPayloadFromRowDuplicate(
  current: RoomsSlice,
  duplicates: RowDuplicatePayload[],
): RoomsReplacePayload {
  const rooms = [...current.rooms];
  const liveNames = new Set(
    rooms.map((room) => stringFromCustomValues(room.custom_values, "name")),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as RoomRow;
    const sourceName = stringFromCustomValues(source.custom_values, "name");
    const newName = nextCopySuffix(sourceName, liveNames);
    liveNames.add(newName);
    const clone: RoomRow = {
      ...source,
      id: duplicate.rowId,
      custom_values: { ...source.custom_values, name: newName },
    };
    const anchorIndex = duplicate.anchorRowId
      ? rooms.findIndex((room) => room.id === duplicate.anchorRowId)
      : -1;
    const insertAt = anchorIndex === -1 ? rooms.length : anchorIndex + 1;
    rooms.splice(insertAt, 0, normalizeRoomForPayload(clone, current.field_defs));
  }
  return {
    rooms,
    single_select_options: cloneOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function roomsPayloadFromRowDelete(
  current: RoomsSlice,
  deletes: RowDeletePayload[],
): RoomsReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    rooms: current.rooms.filter((room) => !toDelete.has(room.id)),
    single_select_options: cloneOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function pumpsPayloadFromRowInsert(
  current: PumpsSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<PumpRow>,
): PumpsReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.pumps.find((pump) => pump.id === payload.anchorRowId) ?? null)
      : null;
    return normalizePumpForPayload(
      build({
        rowId: payload.rowId,
        fieldDefaults: payload.fieldDefaults,
        anchorRow,
      }),
    );
  });
  return {
    pumps: sortedPumps([...current.pumps, ...built]),
    single_select_options: clonePumpOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function ventilatorsPayloadFromRowInsert(
  current: VentilatorsSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<VentilatorRow>,
): VentilatorsReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.ventilators.find((ventilator) => ventilator.id === payload.anchorRowId) ?? null)
      : null;
    return normalizeVentilatorForPayload(
      build({
        rowId: payload.rowId,
        fieldDefaults: payload.fieldDefaults,
        anchorRow,
      }),
    );
  });
  return {
    ventilators: sortedVentilators([...current.ventilators, ...built]),
    single_select_options: cloneVentilatorOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function fansPayloadFromRowInsert(
  current: FansSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<FanRow>,
): FansReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.fans.find((fan) => fan.id === payload.anchorRowId) ?? null)
      : null;
    return normalizeFanForPayload(
      build({
        rowId: payload.rowId,
        fieldDefaults: payload.fieldDefaults,
        anchorRow,
      }),
    );
  });
  return {
    fans: sortedFans([...current.fans, ...built]),
    single_select_options: cloneFanOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function hotWaterHeatersPayloadFromRowInsert(
  current: HotWaterHeatersSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<HotWaterHeaterRow>,
): HotWaterHeatersReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.hot_water_heaters.find((heater) => heater.id === payload.anchorRowId) ?? null)
      : null;
    return normalizeHotWaterHeaterForPayload(
      build({
        rowId: payload.rowId,
        fieldDefaults: payload.fieldDefaults,
        anchorRow,
      }),
    );
  });
  return {
    hot_water_heaters: sortedHotWaterHeaters([...current.hot_water_heaters, ...built]),
    single_select_options: cloneHotWaterHeaterOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function hotWaterTanksPayloadFromRowInsert(
  current: HotWaterTanksSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<HotWaterTankRow>,
): HotWaterTanksReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.hot_water_tanks.find((tank) => tank.id === payload.anchorRowId) ?? null)
      : null;
    return normalizeHotWaterTankForPayload(
      build({
        rowId: payload.rowId,
        fieldDefaults: payload.fieldDefaults,
        anchorRow,
      }),
    );
  });
  return {
    hot_water_tanks: sortedHotWaterTanks([...current.hot_water_tanks, ...built]),
    single_select_options: cloneHotWaterTankOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function electricHeatersPayloadFromRowInsert(
  current: ElectricHeatersSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<ElectricHeaterRow>,
): ElectricHeatersReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.electric_heaters.find((heater) => heater.id === payload.anchorRowId) ?? null)
      : null;
    return normalizeElectricHeaterForPayload(
      build({
        rowId: payload.rowId,
        fieldDefaults: payload.fieldDefaults,
        anchorRow,
      }),
    );
  });
  return {
    electric_heaters: sortedElectricHeaters([...current.electric_heaters, ...built]),
    single_select_options: cloneElectricHeaterOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function appliancesPayloadFromRowInsert(
  current: AppliancesSlice,
  inserts: RowInsertPayload[],
  build: BuildEmptyRow<ApplianceRow>,
): AppliancesReplacePayload {
  const built = inserts.map((payload) => {
    const anchorRow = payload.anchorRowId
      ? (current.appliances.find((appliance) => appliance.id === payload.anchorRowId) ?? null)
      : null;
    return normalizeApplianceForPayload(
      build({
        rowId: payload.rowId,
        fieldDefaults: payload.fieldDefaults,
        anchorRow,
      }),
    );
  });
  return {
    appliances: sortedAppliances([...current.appliances, ...built]),
    single_select_options: cloneApplianceOptions(current),
    field_defs: [...current.field_defs],
  };
}

// Slice-replace duplicate for Pumps. Like Rooms, but Pumps re-sorts
// after every insert/duplicate (the table maintains its own canonical
// order) — `anchorRowId` is informational here, the clone lands
// wherever `sortedPumps` puts it. Pumps' user-facing identifier is
// `record_id` (stored under `custom_values["record_id"]`) rather than
// `name`, so the suffix resolver runs against that column instead.
export function pumpsPayloadFromRowDuplicate(
  current: PumpsSlice,
  duplicates: RowDuplicatePayload[],
): PumpsReplacePayload {
  const pumps = [...current.pumps];
  const liveNames = new Set(
    pumps.map((pump) => stringFromCustomValues(pump.custom_values, "record_id")),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as PumpRow;
    const sourceName = stringFromCustomValues(source.custom_values, "record_id");
    const newName = nextCopySuffix(sourceName, liveNames);
    liveNames.add(newName);
    const clone: PumpRow = {
      ...source,
      id: duplicate.rowId,
      custom_values: { ...source.custom_values, record_id: newName },
    };
    pumps.push(normalizePumpForPayload(clone));
  }
  return {
    pumps: sortedPumps(pumps),
    single_select_options: clonePumpOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function ventilatorsPayloadFromRowDuplicate(
  current: VentilatorsSlice,
  duplicates: RowDuplicatePayload[],
): VentilatorsReplacePayload {
  const ventilators = [...current.ventilators];
  const liveNames = new Set(
    ventilators.map((ventilator) => stringFromCustomValues(ventilator.custom_values, "record_id")),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as VentilatorRow;
    const sourceName = stringFromCustomValues(source.custom_values, "record_id");
    const newName = nextCopySuffix(sourceName, liveNames);
    liveNames.add(newName);
    const clone: VentilatorRow = {
      ...source,
      id: duplicate.rowId,
      custom_values: { ...source.custom_values, record_id: newName },
    };
    ventilators.push(normalizeVentilatorForPayload(clone));
  }
  return {
    ventilators: sortedVentilators(ventilators),
    single_select_options: cloneVentilatorOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function fansPayloadFromRowDuplicate(
  current: FansSlice,
  duplicates: RowDuplicatePayload[],
): FansReplacePayload {
  const fans = [...current.fans];
  const liveNames = new Set(
    fans.map((fan) => stringFromCustomValues(fan.custom_values, "record_id")),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as FanRow;
    const sourceName = stringFromCustomValues(source.custom_values, "record_id");
    const newName = nextCopySuffix(sourceName, liveNames);
    liveNames.add(newName);
    const clone: FanRow = {
      ...source,
      id: duplicate.rowId,
      custom_values: { ...source.custom_values, record_id: newName },
    };
    fans.push(normalizeFanForPayload(clone));
  }
  return {
    fans: sortedFans(fans),
    single_select_options: cloneFanOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function hotWaterHeatersPayloadFromRowDuplicate(
  current: HotWaterHeatersSlice,
  duplicates: RowDuplicatePayload[],
): HotWaterHeatersReplacePayload {
  const hotWaterHeaters = [...current.hot_water_heaters];
  const liveNames = new Set(
    hotWaterHeaters.map((heater) => stringFromCustomValues(heater.custom_values, "record_id")),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as HotWaterHeaterRow;
    const sourceName = stringFromCustomValues(source.custom_values, "record_id");
    const newName = nextCopySuffix(sourceName, liveNames);
    liveNames.add(newName);
    const clone: HotWaterHeaterRow = {
      ...source,
      id: duplicate.rowId,
      custom_values: { ...source.custom_values, record_id: newName },
    };
    hotWaterHeaters.push(normalizeHotWaterHeaterForPayload(clone));
  }
  return {
    hot_water_heaters: sortedHotWaterHeaters(hotWaterHeaters),
    single_select_options: cloneHotWaterHeaterOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function hotWaterTanksPayloadFromRowDuplicate(
  current: HotWaterTanksSlice,
  duplicates: RowDuplicatePayload[],
): HotWaterTanksReplacePayload {
  const hotWaterTanks = [...current.hot_water_tanks];
  const liveNames = new Set(
    hotWaterTanks.map((tank) => stringFromCustomValues(tank.custom_values, "record_id")),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as HotWaterTankRow;
    const sourceName = stringFromCustomValues(source.custom_values, "record_id");
    const newName = nextCopySuffix(sourceName, liveNames);
    liveNames.add(newName);
    const clone: HotWaterTankRow = {
      ...source,
      id: duplicate.rowId,
      custom_values: { ...source.custom_values, record_id: newName },
    };
    hotWaterTanks.push(normalizeHotWaterTankForPayload(clone));
  }
  return {
    hot_water_tanks: sortedHotWaterTanks(hotWaterTanks),
    single_select_options: cloneHotWaterTankOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function electricHeatersPayloadFromRowDuplicate(
  current: ElectricHeatersSlice,
  duplicates: RowDuplicatePayload[],
): ElectricHeatersReplacePayload {
  const electricHeaters = [...current.electric_heaters];
  const liveNames = new Set(
    electricHeaters.map((heater) => stringFromCustomValues(heater.custom_values, "record_id")),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as ElectricHeaterRow;
    const sourceName = stringFromCustomValues(source.custom_values, "record_id");
    const newName = nextCopySuffix(sourceName, liveNames);
    liveNames.add(newName);
    const clone: ElectricHeaterRow = {
      ...source,
      id: duplicate.rowId,
      custom_values: { ...source.custom_values, record_id: newName },
    };
    electricHeaters.push(normalizeElectricHeaterForPayload(clone));
  }
  return {
    electric_heaters: sortedElectricHeaters(electricHeaters),
    single_select_options: cloneElectricHeaterOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function appliancesPayloadFromRowDuplicate(
  current: AppliancesSlice,
  duplicates: RowDuplicatePayload[],
): AppliancesReplacePayload {
  const appliances = [...current.appliances];
  const liveNames = new Set(
    appliances.map((appliance) => stringFromCustomValues(appliance.custom_values, "record_id")),
  );
  for (const duplicate of duplicates) {
    const source = duplicate.sourceRow as ApplianceRow;
    const sourceName = stringFromCustomValues(source.custom_values, "record_id");
    const newName = nextCopySuffix(sourceName, liveNames);
    liveNames.add(newName);
    const clone: ApplianceRow = {
      ...source,
      id: duplicate.rowId,
      custom_values: { ...source.custom_values, record_id: newName },
    };
    appliances.push(normalizeApplianceForPayload(clone));
  }
  return {
    appliances: sortedAppliances(appliances),
    single_select_options: cloneApplianceOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function pumpsPayloadFromRowDelete(
  current: PumpsSlice,
  deletes: RowDeletePayload[],
): PumpsReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    pumps: current.pumps.filter((pump) => !toDelete.has(pump.id)),
    single_select_options: clonePumpOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function ventilatorsPayloadFromRowDelete(
  current: VentilatorsSlice,
  deletes: RowDeletePayload[],
): VentilatorsReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    ventilators: current.ventilators.filter((ventilator) => !toDelete.has(ventilator.id)),
    single_select_options: cloneVentilatorOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function fansPayloadFromRowDelete(
  current: FansSlice,
  deletes: RowDeletePayload[],
): FansReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    fans: current.fans.filter((fan) => !toDelete.has(fan.id)),
    single_select_options: cloneFanOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function hotWaterHeatersPayloadFromRowDelete(
  current: HotWaterHeatersSlice,
  deletes: RowDeletePayload[],
): HotWaterHeatersReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    hot_water_heaters: current.hot_water_heaters.filter((heater) => !toDelete.has(heater.id)),
    single_select_options: cloneHotWaterHeaterOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function hotWaterTanksPayloadFromRowDelete(
  current: HotWaterTanksSlice,
  deletes: RowDeletePayload[],
): HotWaterTanksReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    hot_water_tanks: current.hot_water_tanks.filter((tank) => !toDelete.has(tank.id)),
    single_select_options: cloneHotWaterTankOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function electricHeatersPayloadFromRowDelete(
  current: ElectricHeatersSlice,
  deletes: RowDeletePayload[],
): ElectricHeatersReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    electric_heaters: current.electric_heaters.filter((heater) => !toDelete.has(heater.id)),
    single_select_options: cloneElectricHeaterOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function appliancesPayloadFromRowDelete(
  current: AppliancesSlice,
  deletes: RowDeletePayload[],
): AppliancesReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    appliances: current.appliances.filter((appliance) => !toDelete.has(appliance.id)),
    single_select_options: cloneApplianceOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function roomsPayloadFromCellWrites(
  current: RoomsSlice,
  writes: RoomCellWrite[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): RoomsReplacePayload {
  const options = cloneOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = roomsOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    const currentList = options[optionKey] ?? [];
    options[optionKey] = normalizeOptionOrders(
      currentList.filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = roomsOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    const currentList = options[optionKey] ?? [];
    options[optionKey] = normalizeOptionOrders([...currentList, ...createdOptions]);
  }
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, RoomCellWrite[]>());
  const customFieldKeys = new Set(current.field_defs.map((field) => field.field_key));
  // §B5 — derive once outside the per-row loop instead of rebuilding
  // on every `applyWritesToRoom` call.
  const linkedFieldKeys = new Set(
    current.field_defs
      .filter((field) => field.field_type === "linked_record")
      .map((field) => field.field_key),
  );
  const rooms = current.rooms.map((room) =>
    applyWritesToRoom(
      room,
      writesByRowId.get(room.id) ?? [],
      customFieldKeys,
      linkedFieldKeys,
      current.field_defs,
    ),
  );
  return {
    rooms,
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function pumpsPayloadFromCellWrites(
  current: PumpsSlice,
  writes: PumpCellWrite[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): PumpsReplacePayload {
  const options = clonePumpOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = pumpOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      options[optionKey].filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = pumpOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    options[optionKey] = normalizeOptionOrders([...options[optionKey], ...createdOptions]);
  }
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, PumpCellWrite[]>());
  const pumps = current.pumps.map((pump) =>
    applyWritesToPump(pump, writesByRowId.get(pump.id) ?? []),
  );
  return {
    pumps: sortedPumps(pumps),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function ventilatorsPayloadFromCellWrites(
  current: VentilatorsSlice,
  writes: VentilatorCellWrite[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): VentilatorsReplacePayload {
  const options = cloneVentilatorOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = ventilatorOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      options[optionKey].filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = ventilatorOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    options[optionKey] = normalizeOptionOrders([...options[optionKey], ...createdOptions]);
  }
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, VentilatorCellWrite[]>());
  const ventilators = current.ventilators.map((ventilator) =>
    applyWritesToVentilator(ventilator, writesByRowId.get(ventilator.id) ?? []),
  );
  return {
    ventilators: sortedVentilators(ventilators),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function fansPayloadFromCellWrites(
  current: FansSlice,
  writes: FanCellWrite[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): FansReplacePayload {
  const options = cloneFanOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = fanOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      options[optionKey].filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = fanOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    options[optionKey] = normalizeOptionOrders([...options[optionKey], ...createdOptions]);
  }
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, FanCellWrite[]>());
  const fans = current.fans.map((fan) => applyWritesToFan(fan, writesByRowId.get(fan.id) ?? []));
  return {
    fans: sortedFans(fans),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function hotWaterHeatersPayloadFromCellWrites(
  current: HotWaterHeatersSlice,
  writes: HotWaterHeaterCellWrite[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): HotWaterHeatersReplacePayload {
  const options = cloneHotWaterHeaterOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = hotWaterHeaterOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      options[optionKey].filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = hotWaterHeaterOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    options[optionKey] = normalizeOptionOrders([...options[optionKey], ...createdOptions]);
  }
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, HotWaterHeaterCellWrite[]>());
  const hotWaterHeaters = current.hot_water_heaters.map((heater) =>
    applyWritesToHotWaterHeater(heater, writesByRowId.get(heater.id) ?? []),
  );
  return {
    hot_water_heaters: sortedHotWaterHeaters(hotWaterHeaters),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function hotWaterTanksPayloadFromCellWrites(
  current: HotWaterTanksSlice,
  writes: HotWaterTankCellWrite[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): HotWaterTanksReplacePayload {
  const options = cloneHotWaterTankOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = hotWaterTankOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      options[optionKey].filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = hotWaterTankOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    options[optionKey] = normalizeOptionOrders([...options[optionKey], ...createdOptions]);
  }
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, HotWaterTankCellWrite[]>());
  const hotWaterTanks = current.hot_water_tanks.map((tank) =>
    applyWritesToHotWaterTank(tank, writesByRowId.get(tank.id) ?? []),
  );
  return {
    hot_water_tanks: sortedHotWaterTanks(hotWaterTanks),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function electricHeatersPayloadFromCellWrites(
  current: ElectricHeatersSlice,
  writes: ElectricHeaterCellWrite[],
): ElectricHeatersReplacePayload {
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, ElectricHeaterCellWrite[]>());
  const electricHeaters = current.electric_heaters.map((heater) =>
    applyWritesToElectricHeater(heater, writesByRowId.get(heater.id) ?? []),
  );
  return {
    electric_heaters: sortedElectricHeaters(electricHeaters),
    single_select_options: cloneElectricHeaterOptions(current),
    field_defs: [...current.field_defs],
  };
}

export function appliancesPayloadFromCellWrites(
  current: AppliancesSlice,
  writes: ApplianceCellWrite[],
  newOptions: Record<string, FieldOption[]>,
  removedOptions: Record<string, string[]> = {},
): AppliancesReplacePayload {
  const options = cloneApplianceOptions(current);
  for (const [fieldKey, removedIds] of Object.entries(removedOptions)) {
    const optionKey = applianceOptionListKeyForFieldKey(fieldKey);
    if (!optionKey || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[optionKey] = normalizeOptionOrders(
      options[optionKey].filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    const optionKey = applianceOptionListKeyForFieldKey(fieldKey);
    if (!optionKey) continue;
    options[optionKey] = normalizeOptionOrders([...options[optionKey], ...createdOptions]);
  }
  const writesByRowId = writes.reduce((byRowId, write) => {
    const rowWrites = byRowId.get(write.rowId);
    if (rowWrites) {
      rowWrites.push(write);
    } else {
      byRowId.set(write.rowId, [write]);
    }
    return byRowId;
  }, new Map<string, ApplianceCellWrite[]>());
  const appliances = current.appliances.map((appliance) =>
    applyWritesToAppliance(appliance, writesByRowId.get(appliance.id) ?? []),
  );
  return {
    appliances: sortedAppliances(appliances),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function validateRoomsPayload(payload: RoomsReplacePayload): string | null {
  const floorOptionIds = new Set(
    payload.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY].map((option) => option.id),
  );
  const zoneOptionIds = new Set(
    payload.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY].map((option) => option.id),
  );
  for (const room of payload.rooms) {
    if (room.floor_level && !floorOptionIds.has(room.floor_level)) {
      return "Floor level option is missing.";
    }
    if (room.building_zone && !zoneOptionIds.has(room.building_zone)) {
      return "Building zone option is missing.";
    }
    if ((customNumberValue(room, "num_people") ?? 0) < 0) {
      return "People must be zero or greater.";
    }
    if ((customNumberValue(room, "num_bedrooms") ?? 0) < 0) {
      return "Bedrooms must be zero or greater.";
    }
    if (room.icfa_factor < 0 || room.icfa_factor > 1) {
      return "iCFA factor must be between 0 and 1.";
    }
  }
  return null;
}

export function validatePumpsPayload(payload: PumpsReplacePayload): string | null {
  const ids = new Set<string>();
  const deviceTypeIds = new Set(
    payload.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY].map((option) => option.id),
  );
  for (const pump of payload.pumps) {
    if (ids.has(pump.id)) return "Pump id already exists in this project.";
    ids.add(pump.id);
    if (pump.device_type && !deviceTypeIds.has(pump.device_type)) {
      return "Pump device type option is missing.";
    }
    if (pump.phase !== null && pump.phase !== 1 && pump.phase !== 3) {
      return "Phase must be 1 or 3.";
    }
    if (pump.link && !/^https?:\/\//.test(pump.link)) {
      return "Pump link must start with http:// or https://.";
    }
  }
  return null;
}

export function validateVentilatorsPayload(payload: VentilatorsReplacePayload): string | null {
  const ids = new Set<string>();
  const insideOutsideIds = new Set(
    payload.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY].map((option) => option.id),
  );
  for (const ventilator of payload.ventilators) {
    if (ids.has(ventilator.id)) return "Ventilator id already exists in this project.";
    ids.add(ventilator.id);
    if (ventilator.inside_outside && !insideOutsideIds.has(ventilator.inside_outside)) {
      return "Ventilator inside/outside option is missing.";
    }
    if (ventilator.url && !/^https?:\/\//.test(ventilator.url)) {
      return "Ventilator URL must start with http:// or https://.";
    }
    const heatRecovery = customNumberValue(ventilator, "heat_recovery_percent");
    if (heatRecovery !== null && (heatRecovery < 0 || heatRecovery > 100)) {
      return "Heat Recovery % must be between 0 and 100.";
    }
    const moistureRecovery = customNumberValue(ventilator, "moisture_recovery_percent");
    if (moistureRecovery !== null && (moistureRecovery < 0 || moistureRecovery > 100)) {
      return "Moisture Recovery % must be between 0 and 100.";
    }
    const merv = customNumberValue(ventilator, "filter_merv_rating");
    if (merv !== null && (merv < 1 || merv > 20)) {
      return "Filter MERV Rating must be between 1 and 20.";
    }
  }
  return null;
}

export function validateFansPayload(payload: FansReplacePayload): string | null {
  const ids = new Set<string>();
  const typeIds = new Set(
    payload.single_select_options[FAN_TYPE_OPTION_KEY].map((option) => option.id),
  );
  for (const fan of payload.fans) {
    if (ids.has(fan.id)) return "Fan id already exists in this project.";
    ids.add(fan.id);
    if (fan.fan_type && !typeIds.has(fan.fan_type)) {
      return "Fan type option is missing.";
    }
    if (fan.phase !== null && fan.phase !== 1 && fan.phase !== 3) {
      return "Phase must be 1 or 3.";
    }
    if (fan.url && !/^https?:\/\//.test(fan.url)) {
      return "Fan URL must start with http:// or https://.";
    }
    const quantity = customNumberValue(fan, "quantity");
    if (quantity !== null && quantity < 0) return "Quantity must be zero or greater.";
    const annualRuntime = customNumberValue(fan, "annual_runtime_min_yr");
    if (annualRuntime !== null && annualRuntime < 0)
      return "Annual Runtime must be zero or greater.";
    const airflow = customNumberValue(fan, "airflow_m3h");
    if (airflow !== null && airflow < 0) return "Airflow must be zero or greater.";
    const amps = customNumberValue(fan, "amps");
    if (amps !== null && amps < 0) return "Amps must be zero or greater.";
    const volts = customNumberValue(fan, "volts");
    if (volts !== null && volts < 0) return "Volts must be zero or greater.";
    const powerFactor = customNumberValue(fan, "power_factor");
    if (powerFactor !== null && (powerFactor < 0 || powerFactor > 1)) {
      return "Power Factor must be between 0 and 1.";
    }
    const watts = customNumberValue(fan, "watts");
    if (watts !== null && watts < 0) return "Watts must be zero or greater.";
  }
  return null;
}

export function validateHotWaterHeatersPayload(
  payload: HotWaterHeatersReplacePayload,
): string | null {
  const ids = new Set<string>();
  const typeIds = new Set(
    payload.single_select_options[HOT_WATER_HEATER_TYPE_OPTION_KEY].map((option) => option.id),
  );
  for (const heater of payload.hot_water_heaters) {
    if (ids.has(heater.id)) return "Hot water heater id already exists in this project.";
    ids.add(heater.id);
    if (heater.heater_type && !typeIds.has(heater.heater_type)) {
      return "Hot water heater type option is missing.";
    }
    if (heater.phase !== null && heater.phase !== 1 && heater.phase !== 3) {
      return "Phase must be 1 or 3.";
    }
    if (heater.url && !/^https?:\/\//.test(heater.url)) {
      return "Hot water heater URL must start with http:// or https://.";
    }
    const quantity = customNumberValue(heater, "quantity");
    if (quantity !== null && quantity < 0) return "Quantity must be zero or greater.";
    const size = customNumberValue(heater, "size_l");
    if (size !== null && size < 0) return "Size must be zero or greater.";
    const amps = customNumberValue(heater, "amps");
    if (amps !== null && amps < 0) return "Amps must be zero or greater.";
    const volts = customNumberValue(heater, "volts");
    if (volts !== null && volts < 0) return "Volts must be zero or greater.";
    const powerFactor = customNumberValue(heater, "power_factor");
    if (powerFactor !== null && (powerFactor < 0 || powerFactor > 1)) {
      return "Power Factor must be between 0 and 1.";
    }
    const watts = customNumberValue(heater, "watts");
    if (watts !== null && watts < 0) return "Watts must be zero or greater.";
    const uef = customNumberValue(heater, "uef");
    if (uef !== null && uef < 0) return "UEF must be zero or greater.";
  }
  return null;
}

export function validateHotWaterTanksPayload(payload: HotWaterTanksReplacePayload): string | null {
  const ids = new Set<string>();
  const typeIds = new Set(
    payload.single_select_options[HOT_WATER_TANK_TYPE_OPTION_KEY].map((option) => option.id),
  );
  const insideOutsideIds = new Set(
    payload.single_select_options[HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY].map(
      (option) => option.id,
    ),
  );
  for (const tank of payload.hot_water_tanks) {
    if (ids.has(tank.id)) return "Hot water tank id already exists in this project.";
    ids.add(tank.id);
    if (tank.tank_type && !typeIds.has(tank.tank_type)) {
      return "Hot water tank type option is missing.";
    }
    if (tank.inside_outside && !insideOutsideIds.has(tank.inside_outside)) {
      return "Hot water tank inside/outside option is missing.";
    }
    if (tank.url && !/^https?:\/\//.test(tank.url)) {
      return "Hot water tank URL must start with http:// or https://.";
    }
    const quantity = customNumberValue(tank, "quantity");
    if (quantity !== null && quantity < 0) return "Quantity must be zero or greater.";
    const size = customNumberValue(tank, "size_l");
    if (size !== null && size < 0) return "Size must be zero or greater.";
    const heatLossRate = customNumberValue(tank, "heat_loss_rate_w_k");
    if (heatLossRate !== null && heatLossRate < 0) {
      return "Heat Loss Rate must be zero or greater.";
    }
  }
  return null;
}

export function validateElectricHeatersPayload(
  payload: ElectricHeatersReplacePayload,
): string | null {
  const ids = new Set<string>();
  for (const heater of payload.electric_heaters) {
    if (ids.has(heater.id)) return "Electric heater id already exists in this project.";
    ids.add(heater.id);
    if (heater.url && !/^https?:\/\//.test(heater.url)) {
      return "Electric heater URL must start with http:// or https://.";
    }
    const watt = customNumberValue(heater, "watt");
    if (watt !== null && watt < 0) return "Watt must be zero or greater.";
  }
  return null;
}

export function validateAppliancesPayload(payload: AppliancesReplacePayload): string | null {
  const ids = new Set<string>();
  const typeIds = new Set(
    payload.single_select_options[APPLIANCE_TYPE_OPTION_KEY].map((option) => option.id),
  );
  const energyStarIds = new Set(
    payload.single_select_options[APPLIANCE_ENERGY_STAR_OPTION_KEY].map((option) => option.id),
  );
  for (const appliance of payload.appliances) {
    if (ids.has(appliance.id)) return "Appliance id already exists in this project.";
    ids.add(appliance.id);
    if (appliance.appliance_type && !typeIds.has(appliance.appliance_type)) {
      return "Appliance type option is missing.";
    }
    if (appliance.energy_star && !energyStarIds.has(appliance.energy_star)) {
      return "Appliance EnergyStar option is missing.";
    }
    if (appliance.url && !/^https?:\/\//.test(appliance.url)) {
      return "Appliance URL must start with http:// or https://.";
    }
    const quantity = customNumberValue(appliance, "quantity");
    if (quantity !== null && quantity < 0) return "Quantity must be zero or greater.";
    const capacity = customNumberValue(appliance, "capacity_m3");
    if (capacity !== null && capacity < 0) return "Capacity must be zero or greater.";
    const cef = customNumberValue(appliance, "cef");
    if (cef !== null && cef < 0) return "CEF must be zero or greater.";
    const imef = customNumberValue(appliance, "imef");
    if (imef !== null && imef < 0) return "IMEF must be zero or greater.";
    const mef = customNumberValue(appliance, "mef");
    if (mef !== null && mef < 0) return "MEF must be zero or greater.";
    const annualEnergy = customNumberValue(appliance, "annual_energy_kwh");
    if (annualEnergy !== null && annualEnergy < 0) {
      return "Annual Energy must be zero or greater.";
    }
  }
  return null;
}

export function replacePumpOptionsPayload(
  current: PumpsSlice,
  key: PumpOptionKey,
  nextOptions: SingleSelectOption[],
  replacements: Record<string, string | null> = {},
): PumpsReplacePayload {
  const options = clonePumpOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const removedReferencedOptionIds = new Set(
    current.pumps
      .map((pump) => pump.device_type)
      .filter(
        (optionId): optionId is string =>
          optionId !== null && optionId !== undefined && !nextOptionIds.has(optionId),
      ),
  );
  for (const optionId of removedReferencedOptionIds) {
    if (!(optionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${optionId}.`);
    }
  }
  const pumps = current.pumps.map((pump) => {
    const currentOptionId = pump.device_type;
    if (!currentOptionId || !(currentOptionId in replacements)) return pump;
    return { ...pump, device_type: replacements[currentOptionId] ?? null };
  });
  return {
    pumps: sortedPumps(pumps),
    single_select_options: options,
  };
}

export function replaceVentilatorOptionsPayload(
  current: VentilatorsSlice,
  key: VentilatorOptionKey,
  nextOptions: SingleSelectOption[],
  replacements: Record<string, string | null> = {},
): VentilatorsReplacePayload {
  const options = cloneVentilatorOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const removedReferencedOptionIds = new Set(
    current.ventilators
      .map((ventilator) => ventilator.inside_outside)
      .filter(
        (optionId): optionId is string =>
          optionId !== null && optionId !== undefined && !nextOptionIds.has(optionId),
      ),
  );
  for (const optionId of removedReferencedOptionIds) {
    if (!(optionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${optionId}.`);
    }
  }
  const ventilators = current.ventilators.map((ventilator) => {
    const currentOptionId = ventilator.inside_outside;
    if (!currentOptionId || !(currentOptionId in replacements)) return ventilator;
    return { ...ventilator, inside_outside: replacements[currentOptionId] ?? null };
  });
  return {
    ventilators: sortedVentilators(ventilators),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function replaceFanOptionsPayload(
  current: FansSlice,
  key: FanOptionKey,
  nextOptions: SingleSelectOption[],
  replacements: Record<string, string | null> = {},
): FansReplacePayload {
  const options = cloneFanOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const removedReferencedOptionIds = new Set(
    current.fans
      .map((fan) => fan.fan_type)
      .filter(
        (optionId): optionId is string =>
          optionId !== null && optionId !== undefined && !nextOptionIds.has(optionId),
      ),
  );
  for (const optionId of removedReferencedOptionIds) {
    if (!(optionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${optionId}.`);
    }
  }
  const fans = current.fans.map((fan) => {
    const currentOptionId = fan.fan_type;
    if (!currentOptionId || !(currentOptionId in replacements)) return fan;
    return { ...fan, fan_type: replacements[currentOptionId] ?? null };
  });
  return {
    fans: sortedFans(fans),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function replaceHotWaterHeaterOptionsPayload(
  current: HotWaterHeatersSlice,
  key: HotWaterHeaterOptionKey,
  nextOptions: SingleSelectOption[],
  replacements: Record<string, string | null> = {},
): HotWaterHeatersReplacePayload {
  const options = cloneHotWaterHeaterOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const removedReferencedOptionIds = new Set(
    current.hot_water_heaters
      .map((heater) => heater.heater_type)
      .filter(
        (optionId): optionId is string =>
          optionId !== null && optionId !== undefined && !nextOptionIds.has(optionId),
      ),
  );
  for (const optionId of removedReferencedOptionIds) {
    if (!(optionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${optionId}.`);
    }
  }
  const hotWaterHeaters = current.hot_water_heaters.map((heater) => {
    const currentOptionId = heater.heater_type;
    if (!currentOptionId || !(currentOptionId in replacements)) return heater;
    return { ...heater, heater_type: replacements[currentOptionId] ?? null };
  });
  return {
    hot_water_heaters: sortedHotWaterHeaters(hotWaterHeaters),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function replaceHotWaterTankOptionsPayload(
  current: HotWaterTanksSlice,
  key: HotWaterTankOptionKey,
  nextOptions: SingleSelectOption[],
  replacements: Record<string, string | null> = {},
): HotWaterTanksReplacePayload {
  const options = cloneHotWaterTankOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const fieldKey = hotWaterTankOptionFieldKey(key);
  const removedReferencedOptionIds = new Set(
    current.hot_water_tanks
      .map((tank) => tank[fieldKey])
      .filter(
        (optionId): optionId is string =>
          optionId !== null && optionId !== undefined && !nextOptionIds.has(optionId),
      ),
  );
  for (const optionId of removedReferencedOptionIds) {
    if (!(optionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${optionId}.`);
    }
  }
  const hotWaterTanks = current.hot_water_tanks.map((tank) => {
    const currentOptionId = tank[fieldKey];
    if (!currentOptionId || !(currentOptionId in replacements)) return tank;
    return { ...tank, [fieldKey]: replacements[currentOptionId] ?? null };
  });
  return {
    hot_water_tanks: sortedHotWaterTanks(hotWaterTanks),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

function hotWaterTankOptionFieldKey(
  key: HotWaterTankOptionKey,
): typeof HOT_WATER_TANK_TYPE_KEY | typeof HOT_WATER_TANK_INSIDE_OUTSIDE_KEY {
  return key === HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY
    ? HOT_WATER_TANK_INSIDE_OUTSIDE_KEY
    : HOT_WATER_TANK_TYPE_KEY;
}

export function replaceApplianceOptionsPayload(
  current: AppliancesSlice,
  key: ApplianceOptionKey,
  nextOptions: SingleSelectOption[],
  replacements: Record<string, string | null> = {},
): AppliancesReplacePayload {
  const options = cloneApplianceOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const removedReferencedOptionIds = new Set(
    current.appliances
      .map((appliance) =>
        key === APPLIANCE_TYPE_OPTION_KEY ? appliance.appliance_type : appliance.energy_star,
      )
      .filter(
        (optionId): optionId is string =>
          optionId !== null && optionId !== undefined && !nextOptionIds.has(optionId),
      ),
  );
  for (const optionId of removedReferencedOptionIds) {
    if (!(optionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${optionId}.`);
    }
  }
  const appliances = current.appliances.map((appliance) => {
    const currentOptionId =
      key === APPLIANCE_TYPE_OPTION_KEY ? appliance.appliance_type : appliance.energy_star;
    if (!currentOptionId || !(currentOptionId in replacements)) return appliance;
    return key === APPLIANCE_TYPE_OPTION_KEY
      ? { ...appliance, appliance_type: replacements[currentOptionId] ?? null }
      : { ...appliance, energy_star: replacements[currentOptionId] ?? null };
  });
  return {
    appliances: sortedAppliances(appliances),
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function replaceRoomOptionsPayload(
  current: RoomsSlice,
  key: RoomOptionKey,
  nextOptions: SingleSelectOption[],
  replacements: Record<string, string | null> = {},
): RoomsReplacePayload {
  const options = cloneOptions(current);
  options[key] = normalizeOptionOrders(nextOptions);
  const nextOptionIds = new Set(options[key].map((option) => option.id));
  const removedReferencedOptionIds = new Set(
    current.rooms
      .map((room) => roomValueForOptionKey(room, key))
      .filter((optionId): optionId is string => optionId !== null && !nextOptionIds.has(optionId)),
  );
  for (const optionId of removedReferencedOptionIds) {
    if (!(optionId in replacements)) {
      throw new Error(`Missing replacement for referenced ${key} option ${optionId}.`);
    }
  }
  const rooms = current.rooms.map((room) => {
    const currentOptionId = roomValueForOptionKey(room, key);
    if (!currentOptionId || !(currentOptionId in replacements)) return room;
    return { ...room, [roomFieldForOptionKey(key)]: replacements[currentOptionId] };
  });
  return {
    rooms,
    single_select_options: options,
    field_defs: [...current.field_defs],
  };
}

export function remoteSliceChangesActiveRoom(
  current: RoomsSlice,
  incoming: RoomsSlice,
  room: RoomRow,
): boolean {
  const currentRoom = current.rooms.find((candidate) => candidate.id === room.id);
  const incomingRoom = incoming.rooms.find((candidate) => candidate.id === room.id);
  if (!currentRoom || !incomingRoom) return true;
  if (roomFingerprint(currentRoom) !== roomFingerprint(incomingRoom)) return true;

  return (
    optionChanged(current, incoming, ROOM_FLOOR_LEVEL_OPTION_KEY, room.floor_level) ||
    optionChanged(current, incoming, ROOM_BUILDING_ZONE_OPTION_KEY, room.building_zone)
  );
}

function cloneOptions(current: RoomsSlice): RoomsReplacePayload["single_select_options"] {
  // Spread the full record so namespaced custom single-select lists
  // (`rooms.cf_*`) round-trip through every whole-table replace path.
  // Without this, plan-16 P3.5 custom single_select fields would lose
  // their option lists on the next cell / row / option mutation.
  const out: RoomsReplacePayload["single_select_options"] = {
    [ROOM_FLOOR_LEVEL_OPTION_KEY]: [...current.single_select_options[ROOM_FLOOR_LEVEL_OPTION_KEY]],
    [ROOM_BUILDING_ZONE_OPTION_KEY]: [
      ...current.single_select_options[ROOM_BUILDING_ZONE_OPTION_KEY],
    ],
  };
  for (const [key, list] of Object.entries(current.single_select_options)) {
    if (key === ROOM_FLOOR_LEVEL_OPTION_KEY || key === ROOM_BUILDING_ZONE_OPTION_KEY) continue;
    out[key] = [...list];
  }
  return out;
}

function applyWritesToRoom(
  room: RoomRow,
  writes: RoomCellWrite[],
  customFieldKeys: ReadonlySet<string>,
  linkedFieldKeys: ReadonlySet<string>,
  fieldDefs: readonly Pick<TableFieldDef, "field_key" | "field_type">[],
): RoomRow {
  if (writes.length === 0) return room;
  let next = room;
  for (const write of writes) {
    next = applyWriteToRoom(next, write.fieldKey, write.value, customFieldKeys, linkedFieldKeys);
  }
  return normalizeRoomForPayload(next, fieldDefs);
}

function applyWriteToRoom(
  room: RoomRow,
  fieldKey: string,
  value: unknown,
  customFieldKeys: ReadonlySet<string>,
  linkedFieldKeys: ReadonlySet<string>,
): RoomRow {
  if (fieldKey === "icfa_factor" && isNullableNumber(value)) {
    return { ...room, icfa_factor: value ?? 0 };
  }
  if (fieldKey === ROOM_FLOOR_LEVEL_KEY && isNullableOptionId(value)) {
    return { ...room, floor_level: value };
  }
  if (fieldKey === ROOM_BUILDING_ZONE_KEY && isNullableOptionId(value)) {
    return { ...room, building_zone: value };
  }
  // Linked-record writes carry a `string[]` id list and land in the
  // `custom_links` bag — never in `custom_values` (backend enforces
  // bag exclusivity).
  if (linkedFieldKeys.has(fieldKey)) {
    return setCustomLink(room, fieldKey, value);
  }
  if (ROOM_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey) || customFieldKeys.has(fieldKey)) {
    return setCustomValue(room, fieldKey, value);
  }
  return room;
}

function applyWritesToPump(pump: PumpRow, writes: PumpCellWrite[]): PumpRow {
  if (writes.length === 0) return pump;
  let next = pump;
  for (const write of writes) {
    next = applyWriteToPump(next, write.fieldKey, write.value);
  }
  return normalizePumpForPayload(next);
}

function applyWritesToVentilator(
  ventilator: VentilatorRow,
  writes: VentilatorCellWrite[],
): VentilatorRow {
  if (writes.length === 0) return ventilator;
  let next = ventilator;
  for (const write of writes) {
    next = applyWriteToVentilator(next, write.fieldKey, write.value);
  }
  return normalizeVentilatorForPayload(next);
}

function applyWritesToFan(fan: FanRow, writes: FanCellWrite[]): FanRow {
  if (writes.length === 0) return fan;
  let next = fan;
  for (const write of writes) {
    next = applyWriteToFan(next, write.fieldKey, write.value);
  }
  return normalizeFanForPayload(next);
}

function applyWritesToHotWaterHeater(
  heater: HotWaterHeaterRow,
  writes: HotWaterHeaterCellWrite[],
): HotWaterHeaterRow {
  if (writes.length === 0) return heater;
  let next = heater;
  for (const write of writes) {
    next = applyWriteToHotWaterHeater(next, write.fieldKey, write.value);
  }
  return normalizeHotWaterHeaterForPayload(next);
}

function applyWritesToHotWaterTank(
  tank: HotWaterTankRow,
  writes: HotWaterTankCellWrite[],
): HotWaterTankRow {
  if (writes.length === 0) return tank;
  let next = tank;
  for (const write of writes) {
    next = applyWriteToHotWaterTank(next, write.fieldKey, write.value);
  }
  return normalizeHotWaterTankForPayload(next);
}

function applyWritesToElectricHeater(
  heater: ElectricHeaterRow,
  writes: ElectricHeaterCellWrite[],
): ElectricHeaterRow {
  if (writes.length === 0) return heater;
  let next = heater;
  for (const write of writes) {
    next = applyWriteToElectricHeater(next, write.fieldKey, write.value);
  }
  return normalizeElectricHeaterForPayload(next);
}

function applyWritesToAppliance(
  appliance: ApplianceRow,
  writes: ApplianceCellWrite[],
): ApplianceRow {
  if (writes.length === 0) return appliance;
  let next = appliance;
  for (const write of writes) {
    next = applyWriteToAppliance(next, write.fieldKey, write.value);
  }
  return normalizeApplianceForPayload(next);
}

function applyWriteToPump(pump: PumpRow, fieldKey: string, value: unknown): PumpRow {
  if (fieldKey === PUMP_DEVICE_TYPE_KEY && isNullableOptionId(value)) {
    return { ...pump, device_type: value };
  }
  if (["notes", "link"].includes(fieldKey) && (value === null || typeof value === "string")) {
    return { ...pump, [fieldKey]: value };
  }
  if (fieldKey === "phase" && isNullableNumber(value)) {
    return { ...pump, [fieldKey]: value };
  }
  if (fieldKey === PUMP_DATASHEET_FIELD_KEY) {
    return { ...pump, datasheet_asset_ids: readAttachmentAssetIds(value) };
  }
  if (PUMP_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey)) {
    return setCustomValue(pump, fieldKey, value);
  }
  return pump;
}

function applyWriteToVentilator(
  ventilator: VentilatorRow,
  fieldKey: string,
  value: unknown,
): VentilatorRow {
  if (fieldKey === VENTILATOR_INSIDE_OUTSIDE_KEY && isNullableOptionId(value)) {
    return { ...ventilator, inside_outside: value };
  }
  if (["notes", "url"].includes(fieldKey) && (value === null || typeof value === "string")) {
    return { ...ventilator, [fieldKey]: value };
  }
  if (VENTILATOR_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey)) {
    return setCustomValue(ventilator, fieldKey, value);
  }
  return ventilator;
}

function applyWriteToFan(fan: FanRow, fieldKey: string, value: unknown): FanRow {
  if (fieldKey === FAN_TYPE_KEY && isNullableOptionId(value)) {
    return { ...fan, fan_type: value };
  }
  if (["notes", "url"].includes(fieldKey) && (value === null || typeof value === "string")) {
    return { ...fan, [fieldKey]: value };
  }
  if (fieldKey === "phase" && isNullableNumber(value)) {
    return { ...fan, phase: value };
  }
  if (fieldKey === FAN_DATASHEET_FIELD_KEY) {
    return { ...fan, datasheet_asset_ids: readAttachmentAssetIds(value) };
  }
  if (FAN_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey)) {
    return setCustomValue(fan, fieldKey, value);
  }
  return fan;
}

function applyWriteToHotWaterHeater(
  heater: HotWaterHeaterRow,
  fieldKey: string,
  value: unknown,
): HotWaterHeaterRow {
  if (fieldKey === HOT_WATER_HEATER_TYPE_KEY && isNullableOptionId(value)) {
    return { ...heater, heater_type: value };
  }
  if (["notes", "url"].includes(fieldKey) && (value === null || typeof value === "string")) {
    return { ...heater, [fieldKey]: value };
  }
  if (fieldKey === "phase" && isNullableNumber(value)) {
    return { ...heater, phase: value };
  }
  if (fieldKey === HOT_WATER_HEATER_DATASHEET_FIELD_KEY) {
    return { ...heater, datasheet_asset_ids: readAttachmentAssetIds(value) };
  }
  if (HOT_WATER_HEATER_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey)) {
    return setCustomValue(heater, fieldKey, value);
  }
  return heater;
}

function applyWriteToHotWaterTank(
  tank: HotWaterTankRow,
  fieldKey: string,
  value: unknown,
): HotWaterTankRow {
  if (fieldKey === HOT_WATER_TANK_TYPE_KEY && isNullableOptionId(value)) {
    return { ...tank, tank_type: value };
  }
  if (fieldKey === HOT_WATER_TANK_INSIDE_OUTSIDE_KEY && isNullableOptionId(value)) {
    return { ...tank, inside_outside: value };
  }
  if (["notes", "url"].includes(fieldKey) && (value === null || typeof value === "string")) {
    return { ...tank, [fieldKey]: value };
  }
  if (fieldKey === HOT_WATER_TANK_DATASHEET_FIELD_KEY) {
    return { ...tank, datasheet_asset_ids: readAttachmentAssetIds(value) };
  }
  if (HOT_WATER_TANK_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey)) {
    return setCustomValue(tank, fieldKey, value);
  }
  return tank;
}

function applyWriteToElectricHeater(
  heater: ElectricHeaterRow,
  fieldKey: string,
  value: unknown,
): ElectricHeaterRow {
  if (["notes", "url"].includes(fieldKey) && (value === null || typeof value === "string")) {
    return { ...heater, [fieldKey]: value };
  }
  if (ELECTRIC_HEATER_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey)) {
    return setCustomValue(heater, fieldKey, value);
  }
  return heater;
}

function applyWriteToAppliance(
  appliance: ApplianceRow,
  fieldKey: string,
  value: unknown,
): ApplianceRow {
  if (fieldKey === APPLIANCE_TYPE_KEY && isNullableOptionId(value)) {
    return { ...appliance, appliance_type: value };
  }
  if (fieldKey === APPLIANCE_ENERGY_STAR_KEY && isNullableOptionId(value)) {
    return { ...appliance, energy_star: value };
  }
  if (["notes", "url"].includes(fieldKey) && (value === null || typeof value === "string")) {
    return { ...appliance, [fieldKey]: value };
  }
  if (fieldKey === APPLIANCE_DATASHEET_FIELD_KEY) {
    return { ...appliance, datasheet_asset_ids: readAttachmentAssetIds(value) };
  }
  if (APPLIANCE_CUSTOM_VALUE_FIELD_KEYS.has(fieldKey)) {
    return setCustomValue(appliance, fieldKey, value);
  }
  return appliance;
}

function isNullableOptionId(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.startsWith("opt_"));
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

export function isPumpOptionKey(key: string): key is PumpOptionKey {
  return key === PUMP_DEVICE_TYPE_OPTION_KEY;
}

export function isVentilatorOptionKey(key: string): key is VentilatorOptionKey {
  return key === VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY;
}

export function isFanOptionKey(key: string): key is FanOptionKey {
  return key === FAN_TYPE_OPTION_KEY;
}

export function isHotWaterHeaterOptionKey(key: string): key is HotWaterHeaterOptionKey {
  return key === HOT_WATER_HEATER_TYPE_OPTION_KEY;
}

export function isHotWaterTankOptionKey(key: string): key is HotWaterTankOptionKey {
  return key === HOT_WATER_TANK_TYPE_OPTION_KEY;
}

export function isApplianceOptionKey(key: string): key is ApplianceOptionKey {
  return key === APPLIANCE_TYPE_OPTION_KEY || key === APPLIANCE_ENERGY_STAR_OPTION_KEY;
}

export function isRoomOptionKey(key: string): key is RoomOptionKey {
  return key === ROOM_FLOOR_LEVEL_OPTION_KEY || key === ROOM_BUILDING_ZONE_OPTION_KEY;
}

// Broader than `isRoomOptionKey`: accepts the two core rooms option
// keys plus any namespaced custom single-select list under the
// `rooms.cf_*` prefix. Used by cell-write payloads where
// `newOptions` / `removedOptions` may target a custom single_select.
function isRoomsOptionListKey(key: string): boolean {
  return isRoomOptionKey(key) || key.startsWith(ROOMS_CUSTOM_OPTION_PREFIX);
}

function roomsOptionListKeyForFieldKey(fieldKey: string): string | null {
  if (fieldKey === ROOM_FLOOR_LEVEL_KEY) return ROOM_FLOOR_LEVEL_OPTION_KEY;
  if (fieldKey === ROOM_BUILDING_ZONE_KEY) return ROOM_BUILDING_ZONE_OPTION_KEY;
  if (isRoomsOptionListKey(fieldKey)) return fieldKey;
  if (isCustomFieldKey(fieldKey)) return `${ROOMS_TABLE_NAME}.${fieldKey}`;
  return null;
}

function pumpOptionListKeyForFieldKey(fieldKey: string): PumpOptionKey | null {
  if (fieldKey === PUMP_DEVICE_TYPE_KEY || fieldKey === PUMP_DEVICE_TYPE_OPTION_KEY) {
    return PUMP_DEVICE_TYPE_OPTION_KEY;
  }
  return null;
}

function ventilatorOptionListKeyForFieldKey(fieldKey: string): VentilatorOptionKey | null {
  if (
    fieldKey === VENTILATOR_INSIDE_OUTSIDE_KEY ||
    fieldKey === VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY
  ) {
    return VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY;
  }
  return null;
}

function fanOptionListKeyForFieldKey(fieldKey: string): FanOptionKey | null {
  if (fieldKey === FAN_TYPE_KEY || fieldKey === FAN_TYPE_OPTION_KEY) {
    return FAN_TYPE_OPTION_KEY;
  }
  return null;
}

function hotWaterHeaterOptionListKeyForFieldKey(fieldKey: string): HotWaterHeaterOptionKey | null {
  if (fieldKey === HOT_WATER_HEATER_TYPE_KEY || fieldKey === HOT_WATER_HEATER_TYPE_OPTION_KEY) {
    return HOT_WATER_HEATER_TYPE_OPTION_KEY;
  }
  return null;
}

function hotWaterTankOptionListKeyForFieldKey(fieldKey: string): HotWaterTankOptionKey | null {
  if (fieldKey === HOT_WATER_TANK_TYPE_KEY || fieldKey === HOT_WATER_TANK_TYPE_OPTION_KEY) {
    return HOT_WATER_TANK_TYPE_OPTION_KEY;
  }
  return null;
}

function applianceOptionListKeyForFieldKey(fieldKey: string): ApplianceOptionKey | null {
  if (fieldKey === APPLIANCE_TYPE_KEY || fieldKey === APPLIANCE_TYPE_OPTION_KEY) {
    return APPLIANCE_TYPE_OPTION_KEY;
  }
  if (fieldKey === APPLIANCE_ENERGY_STAR_KEY || fieldKey === APPLIANCE_ENERGY_STAR_OPTION_KEY) {
    return APPLIANCE_ENERGY_STAR_OPTION_KEY;
  }
  return null;
}

function roomFieldForOptionKey(key: RoomOptionKey): "floor_level" | "building_zone" {
  return key === ROOM_FLOOR_LEVEL_OPTION_KEY ? "floor_level" : "building_zone";
}

function roomValueForOptionKey(room: RoomRow, key: RoomOptionKey): string | null {
  return room[roomFieldForOptionKey(key)];
}

function upsertOption(
  options: RoomsReplacePayload["single_select_options"],
  key: RoomOptionKey,
  rawLabel: string,
): string | null {
  const label = rawLabel.trim();
  if (!label) return null;
  const existing = findFieldOptionByLabel(options[key], label);
  if (existing) return existing.id;
  const nextOption: SingleSelectOption = createFieldOption(label, options[key]);
  options[key] = [...options[key], nextOption];
  return nextOption.id;
}

function normalizeRoomForPayload(
  room: RoomRow,
  fieldDefs: readonly Pick<
    TableFieldDef,
    "field_key" | "field_type"
  >[] = ROOMS_COMPAT_BUILT_IN_FIELD_DEFS,
): RoomRow {
  const fieldDefByKey = new Map(fieldDefs.map((field) => [field.field_key, field]));
  return {
    ...room,
    custom_values: {
      ...room.custom_values,
      number: normalizeRoomCustomValue(room, "number", fieldDefByKey.get("number"), {
        numberFallback: null,
      }),
      name: normalizeRoomCustomValue(room, "name", fieldDefByKey.get("name"), {
        numberFallback: null,
      }),
      num_people: normalizeRoomCustomValue(room, "num_people", fieldDefByKey.get("num_people"), {
        numberFallback: null,
        clampNonNegativeInteger: true,
      }),
      num_bedrooms: normalizeRoomCustomValue(
        room,
        "num_bedrooms",
        fieldDefByKey.get("num_bedrooms"),
        { numberFallback: null, clampNonNegativeInteger: true },
      ),
    },
    icfa_factor: clamp(room.icfa_factor || 0, 0, 1),
    notes: room.notes?.trim() || null,
  };
}

function normalizeRoomCustomValue(
  room: RoomRow,
  fieldKey: string,
  fieldDef: Pick<TableFieldDef, "field_type"> | undefined,
  opts: { numberFallback: number | null; clampNonNegativeInteger?: boolean },
): CustomValue {
  const value = room.custom_values[fieldKey];
  if (fieldDef?.field_type === "number") {
    const parsed = customNumberValue(room, fieldKey);
    if (parsed === null) return opts.numberFallback;
    const numeric = opts.clampNonNegativeInteger ? Math.max(0, Math.trunc(parsed)) : parsed;
    return numeric;
  }
  if (fieldDef?.field_type === "single_select") {
    return typeof value === "string" && value.trim() ? value : null;
  }
  const text = customTextValueOrNull(room, fieldKey);
  return text === null ? null : text.trim() || null;
}

function normalizePumpForPayload(pump: PumpRow): PumpRow {
  const phase =
    pump.phase === null || pump.phase === undefined ? null : Math.trunc(Number(pump.phase));
  return {
    ...pump,
    phase: phase === 1 || phase === 3 ? phase : pump.phase,
    custom_values: {
      ...pump.custom_values,
      record_id: nullableTrimmed(customTextValue(pump, "record_id")),
      use: nullableTrimmed(customTextValue(pump, "use")),
      manufacturer: nullableTrimmed(customTextValue(pump, "manufacturer")),
      model: nullableTrimmed(customTextValue(pump, "model")),
      volts: nonNegativeOrNull(customNumberValue(pump, "volts")),
      horse_power: nonNegativeOrNull(customNumberValue(pump, "horse_power")),
      wattage: nonNegativeOrNull(customNumberValue(pump, "wattage")),
      flow_gpm: nonNegativeOrNull(customNumberValue(pump, "flow_gpm")),
      runtime_khr_yr: nonNegativeOrNull(customNumberValue(pump, "runtime_khr_yr")),
    },
    notes: pump.notes?.trim() || null,
    link: pump.link?.trim() || null,
    datasheet_asset_ids: readAttachmentAssetIds(pump.datasheet_asset_ids),
  };
}

function normalizeVentilatorForPayload(ventilator: VentilatorRow): VentilatorRow {
  return {
    ...ventilator,
    custom_values: {
      ...ventilator.custom_values,
      record_id: nullableTrimmed(customTextValue(ventilator, "record_id")),
      name: nullableTrimmed(customTextValue(ventilator, "name")),
      airflow_rate_m3h: nonNegativeOrNull(customNumberValue(ventilator, "airflow_rate_m3h")),
      model: nullableTrimmed(customTextValue(ventilator, "model")),
      manufacturer: nullableTrimmed(customTextValue(ventilator, "manufacturer")),
      heat_recovery_percent: percentOrNull(customNumberValue(ventilator, "heat_recovery_percent")),
      moisture_recovery_percent: percentOrNull(
        customNumberValue(ventilator, "moisture_recovery_percent"),
      ),
      electrical_efficiency_wh_m3: nonNegativeOrNull(
        customNumberValue(ventilator, "electrical_efficiency_wh_m3"),
      ),
      filter_merv_rating: mervOrOriginal(
        customNumberValue(ventilator, "filter_merv_rating"),
        ventilator.custom_values.filter_merv_rating,
      ),
    },
    notes: ventilator.notes?.trim() || null,
    url: ventilator.url?.trim() || null,
  };
}

function normalizeFanForPayload(fan: FanRow): FanRow {
  const phase =
    fan.phase === null || fan.phase === undefined ? null : Math.trunc(Number(fan.phase));
  return {
    ...fan,
    phase: phase === 1 || phase === 3 ? phase : fan.phase,
    custom_values: {
      ...fan.custom_values,
      record_id: nullableTrimmed(customTextValue(fan, "record_id")),
      name: nullableTrimmed(customTextValue(fan, "name")),
      quantity: nonNegativeOrNull(customNumberValue(fan, "quantity")),
      model: nullableTrimmed(customTextValue(fan, "model")),
      manufacturer: nullableTrimmed(customTextValue(fan, "manufacturer")),
      annual_runtime_min_yr: nonNegativeOrNull(customNumberValue(fan, "annual_runtime_min_yr")),
      airflow_m3h: nonNegativeOrNull(customNumberValue(fan, "airflow_m3h")),
      amps: nonNegativeOrNull(customNumberValue(fan, "amps")),
      volts: nonNegativeOrNull(customNumberValue(fan, "volts")),
      power_factor: powerFactorOrOriginal(
        customNumberValue(fan, "power_factor"),
        fan.custom_values.power_factor,
      ),
      watts: nonNegativeOrNull(customNumberValue(fan, "watts")),
    },
    notes: fan.notes?.trim() || null,
    url: fan.url?.trim() || null,
    datasheet_asset_ids: readAttachmentAssetIds(fan.datasheet_asset_ids),
  };
}

function normalizeHotWaterHeaterForPayload(heater: HotWaterHeaterRow): HotWaterHeaterRow {
  const phase =
    heater.phase === null || heater.phase === undefined ? null : Math.trunc(Number(heater.phase));
  return {
    ...heater,
    phase: phase === 1 || phase === 3 ? phase : heater.phase,
    custom_values: {
      ...heater.custom_values,
      record_id: nullableTrimmed(customTextValue(heater, "record_id")),
      name: nullableTrimmed(customTextValue(heater, "name")),
      quantity: nonNegativeOrNull(customNumberValue(heater, "quantity")),
      model: nullableTrimmed(customTextValue(heater, "model")),
      manufacturer: nullableTrimmed(customTextValue(heater, "manufacturer")),
      size_l: nonNegativeOrNull(customNumberValue(heater, "size_l")),
      temperature_c: customNumberValue(heater, "temperature_c"),
      amps: nonNegativeOrNull(customNumberValue(heater, "amps")),
      volts: nonNegativeOrNull(customNumberValue(heater, "volts")),
      power_factor: powerFactorOrOriginal(
        customNumberValue(heater, "power_factor"),
        heater.custom_values.power_factor,
      ),
      watts: nonNegativeOrNull(customNumberValue(heater, "watts")),
      uef: nonNegativeOrNull(customNumberValue(heater, "uef")),
    },
    notes: heater.notes?.trim() || null,
    url: heater.url?.trim() || null,
    datasheet_asset_ids: readAttachmentAssetIds(heater.datasheet_asset_ids),
  };
}

function normalizeHotWaterTankForPayload(tank: HotWaterTankRow): HotWaterTankRow {
  return {
    ...tank,
    custom_values: {
      ...tank.custom_values,
      record_id: nullableTrimmed(customTextValue(tank, "record_id")),
      name: nullableTrimmed(customTextValue(tank, "name")),
      quantity: nonNegativeOrNull(customNumberValue(tank, "quantity")),
      manufacturer: nullableTrimmed(customTextValue(tank, "manufacturer")),
      model: nullableTrimmed(customTextValue(tank, "model")),
      size_l: nonNegativeOrNull(customNumberValue(tank, "size_l")),
      heat_loss_rate_w_k: nonNegativeOrNull(customNumberValue(tank, "heat_loss_rate_w_k")),
    },
    notes: tank.notes?.trim() || null,
    url: tank.url?.trim() || null,
    datasheet_asset_ids: readAttachmentAssetIds(tank.datasheet_asset_ids),
  };
}

function normalizeElectricHeaterForPayload(heater: ElectricHeaterRow): ElectricHeaterRow {
  return {
    ...heater,
    custom_values: {
      ...heater.custom_values,
      record_id: nullableTrimmed(customTextValue(heater, "record_id")),
      name: nullableTrimmed(customTextValue(heater, "name")),
      model: nullableTrimmed(customTextValue(heater, "model")),
      manufacturer: nullableTrimmed(customTextValue(heater, "manufacturer")),
      watt: nonNegativeOrNull(customNumberValue(heater, "watt")),
    },
    notes: heater.notes?.trim() || null,
    url: heater.url?.trim() || null,
  };
}

function normalizeApplianceForPayload(appliance: ApplianceRow): ApplianceRow {
  return {
    ...appliance,
    custom_values: {
      ...appliance.custom_values,
      record_id: nullableTrimmed(customTextValue(appliance, "record_id")),
      name: nullableTrimmed(customTextValue(appliance, "name")),
      quantity: nonNegativeOrNull(customNumberValue(appliance, "quantity")),
      model: nullableTrimmed(customTextValue(appliance, "model")),
      manufacturer: nullableTrimmed(customTextValue(appliance, "manufacturer")),
      capacity_m3: nonNegativeOrNull(customNumberValue(appliance, "capacity_m3")),
      cef: nonNegativeOrNull(customNumberValue(appliance, "cef")),
      imef: nonNegativeOrNull(customNumberValue(appliance, "imef")),
      mef: nonNegativeOrNull(customNumberValue(appliance, "mef")),
      annual_energy_kwh: nonNegativeOrNull(customNumberValue(appliance, "annual_energy_kwh")),
    },
    notes: appliance.notes?.trim() || null,
    url: appliance.url?.trim() || null,
    datasheet_asset_ids: readAttachmentAssetIds(appliance.datasheet_asset_ids),
  };
}

function nullableTrimmed(value: string): string | null {
  return value.trim() || null;
}

function nonNegativeOrNull(value: number | null): number | null {
  if (value === null || value === undefined) return null;
  return Math.max(0, value);
}

function percentOrNull(value: number | null): number | null {
  if (value === null || value === undefined) return null;
  return value;
}

function mervOrOriginal(value: number | null, original: CustomValue | undefined): number | null {
  if (value === null || value === undefined) return null;
  const integer = Math.trunc(value);
  if (integer < 1 || integer > 20) {
    return typeof original === "number" ? original : value;
  }
  return integer;
}

function powerFactorOrOriginal(
  value: number | null,
  original: CustomValue | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  if (value < 0 || value > 1) {
    return typeof original === "number" ? original : value;
  }
  return value;
}

function clonePumpOptions(current: PumpsSlice): PumpsReplacePayload["single_select_options"] {
  return {
    [PUMP_DEVICE_TYPE_OPTION_KEY]: [...current.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]],
  };
}

function cloneVentilatorOptions(
  current: VentilatorsSlice,
): VentilatorsReplacePayload["single_select_options"] {
  return {
    [VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY]: [
      ...current.single_select_options[VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY],
    ],
  };
}

function cloneFanOptions(current: FansSlice): FansReplacePayload["single_select_options"] {
  return {
    [FAN_TYPE_OPTION_KEY]: [...current.single_select_options[FAN_TYPE_OPTION_KEY]],
  };
}

function cloneHotWaterHeaterOptions(
  current: HotWaterHeatersSlice,
): HotWaterHeatersReplacePayload["single_select_options"] {
  return {
    [HOT_WATER_HEATER_TYPE_OPTION_KEY]: [
      ...current.single_select_options[HOT_WATER_HEATER_TYPE_OPTION_KEY],
    ],
  };
}

function cloneHotWaterTankOptions(
  current: HotWaterTanksSlice,
): HotWaterTanksReplacePayload["single_select_options"] {
  return {
    [HOT_WATER_TANK_TYPE_OPTION_KEY]: [
      ...current.single_select_options[HOT_WATER_TANK_TYPE_OPTION_KEY],
    ],
    [HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY]: [
      ...current.single_select_options[HOT_WATER_TANK_INSIDE_OUTSIDE_OPTION_KEY],
    ],
  };
}

function cloneElectricHeaterOptions(
  current: ElectricHeatersSlice,
): ElectricHeatersReplacePayload["single_select_options"] {
  return Object.fromEntries(
    Object.entries(current.single_select_options).map(([key, options]) => [key, [...options]]),
  );
}

function cloneApplianceOptions(
  current: AppliancesSlice,
): AppliancesReplacePayload["single_select_options"] {
  return {
    [APPLIANCE_TYPE_OPTION_KEY]: [...current.single_select_options[APPLIANCE_TYPE_OPTION_KEY]],
    [APPLIANCE_ENERGY_STAR_OPTION_KEY]: [
      ...current.single_select_options[APPLIANCE_ENERGY_STAR_OPTION_KEY],
    ],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function optionChanged(
  current: RoomsSlice,
  incoming: RoomsSlice,
  key: RoomOptionKey,
  optionId: string | null,
): boolean {
  if (!optionId) return false;
  return (
    optionFingerprint(findOption(current, key, optionId)) !==
    optionFingerprint(findOption(incoming, key, optionId))
  );
}

function findOption(
  slice: RoomsSlice,
  key: RoomOptionKey,
  optionId: string,
): SingleSelectOption | undefined {
  return slice.single_select_options[key].find((candidate) => candidate.id === optionId);
}

function roomFingerprint(room: RoomRow): string {
  return JSON.stringify([
    room.id,
    room.custom_values,
    room.custom_links,
    room.floor_level,
    room.building_zone,
    room.icfa_factor,
    room.catalog_origin,
    room.notes,
  ]);
}

function optionFingerprint(option: SingleSelectOption | undefined): string {
  if (!option) return "";
  return JSON.stringify([option.id, option.label, option.color, option.order]);
}
