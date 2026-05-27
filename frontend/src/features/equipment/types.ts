import type { FieldOption, TableFieldDef } from "../../shared/ui/data-table";

export type SingleSelectOption = FieldOption;

export type RoomRow = {
  id: string;
  number: string;
  name: string;
  floor_level: string | null;
  building_zone: string | null;
  num_people: number;
  num_bedrooms: number;
  icfa_factor: number;
  erv_unit_ids: string[];
  catalog_origin: Record<string, unknown> | null;
  notes: string | null;
  // Plan-13 §4.1 / plan-14 P1.1: sparse user-defined values keyed by
  // the custom field's stable `cf_*` id. Always present (defaults to
  // {}) so consumers can spread without a null check.
  custom: Record<string, unknown>;
};

export const ROOM_FLOOR_LEVEL_KEY = "floor_level";
export const ROOM_BUILDING_ZONE_KEY = "building_zone";
export const ROOM_FLOOR_LEVEL_OPTION_KEY = "rooms.floor_level";
export const ROOM_BUILDING_ZONE_OPTION_KEY = "rooms.building_zone";
export const ROOM_OPTION_KEYS = [
  ROOM_FLOOR_LEVEL_OPTION_KEY,
  ROOM_BUILDING_ZONE_OPTION_KEY,
] as const;
export const ROOMS_TABLE_NAME = "rooms";

// Single-select option fields use a namespaced `field_key`
// ("rooms.floor_level") but the table column id is the short form. Both
// `RoomsTable` (real columns) and `roomsTableColumnsForSanitize`
// (sanitize stubs) must share these so saved view state lines up.
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
  rows_computed?: Record<string, Record<string, unknown>>;
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
export const PUMP_DEVICE_TYPE_KEY = "device_type";
export const PUMP_DEVICE_TYPE_OPTION_KEY = "pumps.device_type";
export const PUMP_DEVICE_TYPE_COLUMN_ID = "device_type";
export const PUMP_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const PUMP_OPTION_KEYS = [PUMP_DEVICE_TYPE_OPTION_KEY] as const;

export type PumpOptionKey = (typeof PUMP_OPTION_KEYS)[number];

export type PumpRow = {
  id: string;
  device_type: string | null;
  use: string | null;
  tag: string | null;
  manufacturer: string | null;
  model: string | null;
  volts: number | null;
  phase: number | null;
  horse_power: number | null;
  wattage: number | null;
  flow_gpm: number | null;
  runtime_khr_yr: number | null;
  notes: string | null;
  link: string | null;
  datasheet_asset_ids: string[];
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
};

export type PumpsReplacePayload = {
  pumps: PumpRow[];
  field_defs?: TableFieldDef[];
  single_select_options: PumpsOptionMap;
};
