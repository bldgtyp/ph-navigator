import type { FieldOption, TableFieldDef } from "../../shared/ui/data-table";

export type SingleSelectOption = FieldOption;
export type CustomValue = string | number | boolean | null;

export type InverseLinks = Record<string, Record<string, string[]>>;
export type RowsComputed = Record<string, Record<string, unknown>>;

export type InverseLinkField = {
  source_key: string;
  source_table_path: string[];
  source_table_display: string;
  source_field_key: string;
  source_field_display_name: string;
};

export type RoomRow = {
  id: string;
  floor_level: string | null;
  building_zone: string | null;
  icfa_factor: number;
  catalog_origin: Record<string, unknown> | null;
  notes: string | null;
  // Backend `custom_values` bag keyed by every mutable-type FieldDef
  // (`number`, `name`, `num_people`, `num_bedrooms`, and `cf_*` fields).
  custom_values: Record<string, CustomValue>;
  // PRD Q4 / Q16: parallel bag keyed by `linked_record` field keys —
  // values are id lists pointing at rows in the target table.
  custom_links?: Record<string, string[]>;
};

export const ROOM_FLOOR_LEVEL_KEY = "floor_level";
export const ROOM_BUILDING_ZONE_KEY = "building_zone";
export const ROOM_SPACE_TYPE_FIELD_KEY = "space_type_id";
export const ROOM_FLOOR_LEVEL_OPTION_KEY = "rooms.floor_level";
export const ROOM_BUILDING_ZONE_OPTION_KEY = "rooms.building_zone";
export const ROOM_OPTION_KEYS = [
  ROOM_FLOOR_LEVEL_OPTION_KEY,
  ROOM_BUILDING_ZONE_OPTION_KEY,
] as const;
export const ROOMS_TABLE_NAME = "rooms";

// Rooms option-map keys stay namespaced (`rooms.floor_level`), while
// table FieldDef keys and column ids use the backend field keys.
// `RoomsTable` and `roomsTableColumnsForSanitize` share these ids so
// saved view state lines up.
export const ROOM_FLOOR_LEVEL_COLUMN_ID = "floor_level";
export const ROOM_BUILDING_ZONE_COLUMN_ID = "building_zone";

export type RoomOptionKey = (typeof ROOM_OPTION_KEYS)[number];

export type RoomsSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  rooms: RoomRow[];
  // Phase 1b: persisted FieldDef array — built-in + custom entries
  // share one stream keyed by `field_key`. Always present.
  field_defs: TableFieldDef[];
  // String-keyed so custom single_select fields' `rooms.<cf_id>` lists
  // ride alongside the two core keys. The intersection preserves the
  // type-level guarantee that the two core keys are always present (the
  // backend always emits them).
  single_select_options: RoomsOptionMap;
  // Plan-17 P4.4: read-overlay for formula custom fields. Keyed by
  // room id then by `cf_*` field id. Empty when the table has no
  // formula fields. Successful evaluations are raw scalars; failures
  // are `{error: "<token>"}` objects (see `ComputedCellValue`).
  // Optional to keep test fixtures and pre-P4.4 payloads compatible
  // — consumers treat a missing overlay as `{}`.
  rows_computed?: RowsComputed;
  inverse_links?: InverseLinks;
  inverse_link_fields?: InverseLinkField[];
  inverse_links_fingerprint?: string;
};

export type RoomsOptionMap = Record<RoomOptionKey, SingleSelectOption[]> & {
  [key: string]: SingleSelectOption[];
};

export type RoomsReplacePayload = {
  rooms: RoomRow[];
  field_defs?: TableFieldDef[];
  single_select_options: RoomsOptionMap;
};

export const PUMPS_TABLE_NAME = "pumps";
// Canonical backend table path for FieldDef `linked_record_config.target_table_path`.
// `PUMPS_TABLE_NAME` is the single-segment display key; persisted paths
// always carry the 2-segment ["equipment", "pumps"] form.
export const PUMPS_TARGET_TABLE_PATH = ["equipment", "pumps"] as const;
export const PUMP_DEVICE_TYPE_KEY = "device_type";
export const PUMP_DEVICE_TYPE_OPTION_KEY = "pumps.device_type";
export const PUMP_DEVICE_TYPE_COLUMN_ID = "device_type";
export const PUMP_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const PUMP_OPTION_KEYS = [PUMP_DEVICE_TYPE_OPTION_KEY] as const;

export type PumpOptionKey = (typeof PUMP_OPTION_KEYS)[number];

export type PumpRow = {
  id: string;
  device_type: string | null;
  phase: number | null;
  notes: string | null;
  link: string | null;
  datasheet_asset_ids: string[];
  // `record_id` replaces the old typed `tag`; the other mutable
  // built-ins listed here share storage with custom `cf_*` fields.
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type PumpsOptionMap = Record<PumpOptionKey, SingleSelectOption[]>;

export type PumpsSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  pumps: PumpRow[];
  // Phase 1b: same persisted FieldDef stream as Rooms — built-in +
  // custom entries keyed by `field_key`. Always present.
  field_defs: TableFieldDef[];
  single_select_options: PumpsOptionMap;
  rows_computed?: RowsComputed;
  inverse_links?: InverseLinks;
  inverse_link_fields?: InverseLinkField[];
  inverse_links_fingerprint?: string;
};

export type PumpsReplacePayload = {
  pumps: PumpRow[];
  field_defs?: TableFieldDef[];
  single_select_options: PumpsOptionMap;
};

export const VENTILATORS_TABLE_NAME = "ventilators";
export const VENTILATOR_INSIDE_OUTSIDE_KEY = "inside_outside";
export const VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY = "ventilators.inside_outside";
export const VENTILATOR_INSIDE_OUTSIDE_COLUMN_ID = "inside_outside";
export const VENTILATOR_OPTION_KEYS = [VENTILATOR_INSIDE_OUTSIDE_OPTION_KEY] as const;

export type VentilatorOptionKey = (typeof VENTILATOR_OPTION_KEYS)[number];

export type VentilatorRow = {
  id: string;
  inside_outside: string | null;
  url: string | null;
  notes: string | null;
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type VentilatorsOptionMap = Record<VentilatorOptionKey, SingleSelectOption[]>;

export type VentilatorsSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  ventilators: VentilatorRow[];
  field_defs: TableFieldDef[];
  single_select_options: VentilatorsOptionMap;
  rows_computed?: RowsComputed;
};

export type VentilatorsReplacePayload = {
  ventilators: VentilatorRow[];
  field_defs?: TableFieldDef[];
  single_select_options: VentilatorsOptionMap;
};

export const THERMAL_BRIDGES_TABLE_NAME = "thermal_bridges";
export const THERMAL_BRIDGE_TYPE_KEY = "thermal_bridge_type";
export const THERMAL_BRIDGE_TYPE_OPTION_KEY = "thermal_bridges.type";
export const THERMAL_BRIDGE_TYPE_COLUMN_ID = "thermal_bridge_type";
export const THERMAL_BRIDGE_PDF_REPORT_FIELD_KEY = "pdf_report_asset_ids";
export const THERMAL_BRIDGE_OPTION_KEYS = [THERMAL_BRIDGE_TYPE_OPTION_KEY] as const;

export type ThermalBridgeOptionKey = (typeof THERMAL_BRIDGE_OPTION_KEYS)[number];

export type ThermalBridgeRow = {
  id: string;
  thermal_bridge_type: string | null;
  pdf_report_asset_ids: string[];
  notes: string | null;
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type ThermalBridgesOptionMap = Record<ThermalBridgeOptionKey, SingleSelectOption[]> & {
  [key: string]: SingleSelectOption[];
};

export type ThermalBridgesSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  thermal_bridges: ThermalBridgeRow[];
  field_defs: TableFieldDef[];
  single_select_options: ThermalBridgesOptionMap;
  rows_computed?: RowsComputed;
};

export type ThermalBridgesReplacePayload = {
  thermal_bridges: ThermalBridgeRow[];
  field_defs?: TableFieldDef[];
  single_select_options: ThermalBridgesOptionMap;
};

export const FANS_TABLE_NAME = "fans";
export const FAN_TYPE_KEY = "fan_type";
export const FAN_TYPE_OPTION_KEY = "fans.type";
export const FAN_TYPE_COLUMN_ID = "fan_type";
export const FAN_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const FAN_OPTION_KEYS = [FAN_TYPE_OPTION_KEY] as const;

export type FanOptionKey = (typeof FAN_OPTION_KEYS)[number];

export type FanRow = {
  id: string;
  fan_type: string | null;
  phase: number | null;
  url: string | null;
  notes: string | null;
  datasheet_asset_ids: string[];
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type FansOptionMap = Record<FanOptionKey, SingleSelectOption[]>;

export type FansSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  fans: FanRow[];
  field_defs: TableFieldDef[];
  single_select_options: FansOptionMap;
  rows_computed?: RowsComputed;
};

export type FansReplacePayload = {
  fans: FanRow[];
  field_defs?: TableFieldDef[];
  single_select_options: FansOptionMap;
};

export const HOT_WATER_HEATERS_TABLE_NAME = "hot_water_heaters";
export const HOT_WATER_HEATER_TYPE_KEY = "heater_type";
export const HOT_WATER_HEATER_TYPE_OPTION_KEY = "hot_water_heaters.type";
export const HOT_WATER_HEATER_TYPE_COLUMN_ID = "heater_type";
export const HOT_WATER_HEATER_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const HOT_WATER_HEATER_OPTION_KEYS = [HOT_WATER_HEATER_TYPE_OPTION_KEY] as const;

export type HotWaterHeaterOptionKey = (typeof HOT_WATER_HEATER_OPTION_KEYS)[number];

export type HotWaterHeaterRow = {
  id: string;
  heater_type: string | null;
  phase: number | null;
  url: string | null;
  notes: string | null;
  datasheet_asset_ids: string[];
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type HotWaterHeatersOptionMap = Record<HotWaterHeaterOptionKey, SingleSelectOption[]>;

export type HotWaterHeatersSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  hot_water_heaters: HotWaterHeaterRow[];
  field_defs: TableFieldDef[];
  single_select_options: HotWaterHeatersOptionMap;
  rows_computed?: RowsComputed;
};

export type HotWaterHeatersReplacePayload = {
  hot_water_heaters: HotWaterHeaterRow[];
  field_defs?: TableFieldDef[];
  single_select_options: HotWaterHeatersOptionMap;
};

export const HOT_WATER_TANKS_TABLE_NAME = "hot_water_tanks";
export const HOT_WATER_TANK_TYPE_KEY = "tank_type";
export const HOT_WATER_TANK_TYPE_OPTION_KEY = "hot_water_tanks.type";
export const HOT_WATER_TANK_TYPE_COLUMN_ID = "tank_type";
export const HOT_WATER_TANK_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const HOT_WATER_TANK_OPTION_KEYS = [HOT_WATER_TANK_TYPE_OPTION_KEY] as const;

export type HotWaterTankOptionKey = (typeof HOT_WATER_TANK_OPTION_KEYS)[number];

export type HotWaterTankRow = {
  id: string;
  tank_type: string | null;
  url: string | null;
  notes: string | null;
  datasheet_asset_ids: string[];
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type HotWaterTanksOptionMap = Record<HotWaterTankOptionKey, SingleSelectOption[]>;

export type HotWaterTanksSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  hot_water_tanks: HotWaterTankRow[];
  field_defs: TableFieldDef[];
  single_select_options: HotWaterTanksOptionMap;
  rows_computed?: RowsComputed;
};

export type HotWaterTanksReplacePayload = {
  hot_water_tanks: HotWaterTankRow[];
  field_defs?: TableFieldDef[];
  single_select_options: HotWaterTanksOptionMap;
};

export const ELECTRIC_HEATERS_TABLE_NAME = "electric_heaters";

export type ElectricHeaterRow = {
  id: string;
  url: string | null;
  notes: string | null;
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type ElectricHeatersOptionMap = Record<string, SingleSelectOption[]>;

export type ElectricHeatersSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  electric_heaters: ElectricHeaterRow[];
  field_defs: TableFieldDef[];
  single_select_options: ElectricHeatersOptionMap;
  rows_computed?: RowsComputed;
};

export type ElectricHeatersReplacePayload = {
  electric_heaters: ElectricHeaterRow[];
  field_defs?: TableFieldDef[];
  single_select_options: ElectricHeatersOptionMap;
};

export const APPLIANCES_TABLE_NAME = "appliances";
export const APPLIANCE_TYPE_KEY = "appliance_type";
export const APPLIANCE_TYPE_OPTION_KEY = "appliances.type";
export const APPLIANCE_TYPE_COLUMN_ID = "appliance_type";
export const APPLIANCE_ENERGY_STAR_KEY = "energy_star";
export const APPLIANCE_ENERGY_STAR_OPTION_KEY = "appliances.energy_star";
export const APPLIANCE_ENERGY_STAR_COLUMN_ID = "energy_star";
export const APPLIANCE_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const APPLIANCE_OPTION_KEYS = [
  APPLIANCE_TYPE_OPTION_KEY,
  APPLIANCE_ENERGY_STAR_OPTION_KEY,
] as const;

export type ApplianceOptionKey = (typeof APPLIANCE_OPTION_KEYS)[number];

export type ApplianceRow = {
  id: string;
  appliance_type: string | null;
  energy_star: string | null;
  url: string | null;
  notes: string | null;
  datasheet_asset_ids: string[];
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type AppliancesOptionMap = Record<ApplianceOptionKey, SingleSelectOption[]>;

export type AppliancesSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  appliances: ApplianceRow[];
  field_defs: TableFieldDef[];
  single_select_options: AppliancesOptionMap;
  rows_computed?: RowsComputed;
};

export type AppliancesReplacePayload = {
  appliances: ApplianceRow[];
  field_defs?: TableFieldDef[];
  single_select_options: AppliancesOptionMap;
};
