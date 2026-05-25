import type { CustomFieldDef, FieldOption } from "../../shared/ui/data-table";

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

export const ROOM_FLOOR_LEVEL_KEY = "rooms.floor_level";
export const ROOM_BUILDING_ZONE_KEY = "rooms.building_zone";
export const ROOM_OPTION_KEYS = [ROOM_FLOOR_LEVEL_KEY, ROOM_BUILDING_ZONE_KEY] as const;
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
  // Plan-14 P1.1: parallel to `rooms`. Always present (defaults to [])
  // so callers don't branch.
  custom_fields: CustomFieldDef[];
  // String-keyed so custom single_select fields' `rooms.<cf_id>` lists
  // ride alongside the two core keys. The intersection preserves the
  // type-level guarantee that the two core keys are always present (the
  // backend always emits them).
  single_select_options: RoomsOptionMap;
};

export type RoomsOptionMap = Record<RoomOptionKey, SingleSelectOption[]> & {
  [key: string]: SingleSelectOption[];
};

export type RoomsReplacePayload = {
  rooms: RoomRow[];
  custom_fields?: CustomFieldDef[];
  single_select_options: RoomsOptionMap;
};
