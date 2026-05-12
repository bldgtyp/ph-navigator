import type {
  RoomOptionKey,
  RoomRow,
  RoomsReplacePayload,
  RoomsSlice,
  SingleSelectOption,
} from "./types";
import { ROOM_BUILDING_ZONE_KEY, ROOM_FLOOR_LEVEL_KEY } from "./types";

const OPTION_COLORS = ["#3b82f6", "#10b981", "#a16207", "#7c3aed", "#0f766e", "#be123c"];

export function generatedId(prefix: "rm" | "opt"): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}_${random.replace(/[^A-Za-z0-9]/g, "")}`;
}

export function emptyRoom(): RoomRow {
  return {
    id: generatedId("rm"),
    number: "",
    name: "",
    floor_level: null,
    building_zone: null,
    num_people: 0,
    num_bedrooms: 0,
    icfa_factor: 1,
    erv_unit_ids: [],
    catalog_origin: null,
    notes: null,
  };
}

export function optionLabel(options: SingleSelectOption[], optionId: string | null): string {
  if (!optionId) return "";
  return options.find((option) => option.id === optionId)?.label ?? "Missing option";
}

export function sortedRooms(rooms: RoomRow[]): RoomRow[] {
  return [...rooms].sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export function nextRoomsPayload(
  current: RoomsSlice,
  room: RoomRow,
  labels: { floorLevel: string; buildingZone: string },
): RoomsReplacePayload {
  const options = cloneOptions(current);
  const floorLevel = upsertOption(options, ROOM_FLOOR_LEVEL_KEY, labels.floorLevel);
  const buildingZone = upsertOption(options, ROOM_BUILDING_ZONE_KEY, labels.buildingZone);
  const normalizedRoom: RoomRow = {
    ...room,
    number: room.number.trim(),
    name: room.name.trim(),
    floor_level: floorLevel,
    building_zone: buildingZone,
    num_people: Math.max(0, Math.trunc(room.num_people || 0)),
    num_bedrooms: Math.max(0, Math.trunc(room.num_bedrooms || 0)),
    icfa_factor: clamp(room.icfa_factor || 0, 0, 1),
    notes: room.notes?.trim() || null,
  };
  return {
    rooms: sortedRooms([
      normalizedRoom,
      ...current.rooms.filter((candidate) => candidate.id !== normalizedRoom.id),
    ]),
    single_select_options: options,
  };
}

export function deleteRoomPayload(current: RoomsSlice, roomId: string): RoomsReplacePayload {
  return {
    rooms: current.rooms.filter((room) => room.id !== roomId),
    single_select_options: cloneOptions(current),
  };
}

export function duplicateRoomNumber(rooms: RoomRow[], room: RoomRow): boolean {
  const number = normalize(room.number);
  return rooms.some(
    (candidate) => candidate.id !== room.id && normalize(candidate.number) === number,
  );
}

function cloneOptions(current: RoomsSlice): RoomsReplacePayload["single_select_options"] {
  return {
    [ROOM_FLOOR_LEVEL_KEY]: [...current.single_select_options[ROOM_FLOOR_LEVEL_KEY]],
    [ROOM_BUILDING_ZONE_KEY]: [...current.single_select_options[ROOM_BUILDING_ZONE_KEY]],
  };
}

function upsertOption(
  options: RoomsReplacePayload["single_select_options"],
  key: RoomOptionKey,
  rawLabel: string,
): string | null {
  const label = rawLabel.trim();
  if (!label) return null;
  const existing = options[key].find(
    (option) => option.label.trim().toLocaleLowerCase() === label.toLocaleLowerCase(),
  );
  if (existing) return existing.id;
  const nextOption: SingleSelectOption = {
    id: generatedId("opt"),
    label,
    color: OPTION_COLORS[options[key].length % OPTION_COLORS.length] ?? "#6b7280",
    order: options[key].length,
  };
  options[key] = [...options[key], nextOption];
  return nextOption.id;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
