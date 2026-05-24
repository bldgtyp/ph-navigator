import type { FieldOption } from "../../shared/ui/data-table";

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
  single_select_options: Record<RoomOptionKey, SingleSelectOption[]>;
};

export type RoomsReplacePayload = {
  rooms: RoomRow[];
  single_select_options: Record<RoomOptionKey, SingleSelectOption[]>;
};
