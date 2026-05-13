export type SingleSelectOption = {
  id: string;
  label: string;
  color: string;
  order: number;
};

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
