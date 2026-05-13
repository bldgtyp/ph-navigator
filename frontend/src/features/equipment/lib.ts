import type {
  RoomOptionKey,
  RoomRow,
  RoomsReplacePayload,
  RoomsSlice,
  SingleSelectOption,
} from "./types";
import { ROOM_BUILDING_ZONE_KEY, ROOM_FLOOR_LEVEL_KEY } from "./types";
import type { FieldOption } from "../../shared/ui/data-table";
import {
  createFieldOption,
  findFieldOptionByLabel,
  formatDisplayCellValue,
} from "../../shared/ui/data-table/lib";
import { generatedId } from "../../shared/lib/ids";
export {
  isDraftStaleError,
  isInvalidProjectDocumentError,
  isVersionLockedError,
} from "../project_document/lib";

type RoomCellWrite = { rowId: string; fieldKey: string; value: unknown };

export function emptyRoom(defaultFloorLevel: string | null = null): RoomRow {
  return {
    id: generatedId("rm"),
    number: "",
    name: "",
    floor_level: defaultFloorLevel,
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
  return formatDisplayCellValue(optionId, {
    field_key: "single_select_option",
    field_type: "single_select",
    display_name: "Single select option",
    options,
  });
}

export function sortedRooms(rooms: RoomRow[]): RoomRow[] {
  return [...rooms].sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export function firstRoomFloorOptionId(current: RoomsSlice): string | null {
  return (
    [...current.single_select_options[ROOM_FLOOR_LEVEL_KEY]].sort((a, b) => a.order - b.order)[0]
      ?.id ?? null
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
  const normalizedRoom = normalizeRoomForPayload({
    ...room,
    floor_level: floorLevel,
    building_zone: buildingZone,
  });
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

export function roomsPayloadFromCellWrites(
  current: RoomsSlice,
  writes: RoomCellWrite[],
  newOptions: Record<string, FieldOption[]>,
): RoomsReplacePayload {
  const options = cloneOptions(current);
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    if (!isRoomOptionKey(fieldKey)) continue;
    options[fieldKey] = normalizeOptionOrders([...options[fieldKey], ...createdOptions]);
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
  const rooms = current.rooms.map((room) =>
    applyWritesToRoom(room, writesByRowId.get(room.id) ?? []),
  );
  return { rooms: sortedRooms(rooms), single_select_options: options };
}

export function validateRoomsPayload(payload: RoomsReplacePayload): string | null {
  const roomNumbers = new Set<string>();
  const floorOptionIds = new Set(
    payload.single_select_options[ROOM_FLOOR_LEVEL_KEY].map((option) => option.id),
  );
  const zoneOptionIds = new Set(
    payload.single_select_options[ROOM_BUILDING_ZONE_KEY].map((option) => option.id),
  );
  for (const room of payload.rooms) {
    if (!room.number.trim()) return "Room number is required.";
    const normalizedNumber = normalize(room.number);
    if (roomNumbers.has(normalizedNumber)) return "Room number already exists in this project.";
    roomNumbers.add(normalizedNumber);
    if (!room.name.trim()) return "Room name is required.";
    if (!room.floor_level || !floorOptionIds.has(room.floor_level)) {
      return "Floor level is required.";
    }
    if (room.building_zone && !zoneOptionIds.has(room.building_zone)) {
      return "Building zone option is missing.";
    }
    if (room.erv_unit_ids.length > 0) {
      return "ERV assignments are deferred until ERV units are available.";
    }
    if (room.num_people < 0) return "People must be zero or greater.";
    if (room.num_bedrooms < 0) return "Bedrooms must be zero or greater.";
    if (room.icfa_factor < 0 || room.icfa_factor > 1) {
      return "iCFA factor must be between 0 and 1.";
    }
  }
  return null;
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
  return { rooms: sortedRooms(rooms), single_select_options: options };
}

export function optionReferenceCounts(
  rooms: RoomRow[],
  key: RoomOptionKey,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const room of rooms) {
    const optionId = roomValueForOptionKey(room, key);
    if (!optionId) continue;
    counts[optionId] = (counts[optionId] ?? 0) + 1;
  }
  return counts;
}

export function missingOptionReferences(
  rooms: RoomRow[],
  key: RoomOptionKey,
  options: SingleSelectOption[],
): string[] {
  const optionIds = new Set(options.map((option) => option.id));
  return rooms
    .map((room) => roomValueForOptionKey(room, key))
    .filter((optionId): optionId is string => optionId !== null && !optionIds.has(optionId));
}

export function normalizeOptionOrders(options: SingleSelectOption[]): SingleSelectOption[] {
  return options.map((option, index) => ({ ...option, label: option.label.trim(), order: index }));
}

export function duplicateRoomNumber(rooms: RoomRow[], room: RoomRow): boolean {
  const number = normalize(room.number);
  return rooms.some(
    (candidate) => candidate.id !== room.id && normalize(candidate.number) === number,
  );
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
    optionChanged(current, incoming, ROOM_FLOOR_LEVEL_KEY, room.floor_level) ||
    optionChanged(current, incoming, ROOM_BUILDING_ZONE_KEY, room.building_zone)
  );
}

function cloneOptions(current: RoomsSlice): RoomsReplacePayload["single_select_options"] {
  return {
    [ROOM_FLOOR_LEVEL_KEY]: [...current.single_select_options[ROOM_FLOOR_LEVEL_KEY]],
    [ROOM_BUILDING_ZONE_KEY]: [...current.single_select_options[ROOM_BUILDING_ZONE_KEY]],
  };
}

function applyWritesToRoom(room: RoomRow, writes: RoomCellWrite[]): RoomRow {
  if (writes.length === 0) return room;
  let next = room;
  for (const write of writes) {
    next = applyWriteToRoom(next, write.fieldKey, write.value);
  }
  return normalizeRoomForPayload(next);
}

function applyWriteToRoom(room: RoomRow, fieldKey: string, value: unknown): RoomRow {
  if (fieldKey === "number" && typeof value === "string") return { ...room, number: value };
  if (fieldKey === "name" && typeof value === "string") return { ...room, name: value };
  if (fieldKey === "num_people" && isNullableNumber(value)) {
    return { ...room, num_people: value ?? 0 };
  }
  if (fieldKey === "num_bedrooms" && isNullableNumber(value)) {
    return { ...room, num_bedrooms: value ?? 0 };
  }
  if (fieldKey === "icfa_factor" && isNullableNumber(value)) {
    return { ...room, icfa_factor: value ?? 0 };
  }
  if (fieldKey === ROOM_FLOOR_LEVEL_KEY && isNullableOptionId(value)) {
    return { ...room, floor_level: value };
  }
  if (fieldKey === ROOM_BUILDING_ZONE_KEY && isNullableOptionId(value)) {
    return { ...room, building_zone: value };
  }
  return room;
}

function isNullableOptionId(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.startsWith("opt_"));
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isRoomOptionKey(key: string): key is RoomOptionKey {
  return key === ROOM_FLOOR_LEVEL_KEY || key === ROOM_BUILDING_ZONE_KEY;
}

function roomFieldForOptionKey(key: RoomOptionKey): "floor_level" | "building_zone" {
  return key === ROOM_FLOOR_LEVEL_KEY ? "floor_level" : "building_zone";
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

function normalizeRoomForPayload(room: RoomRow): RoomRow {
  return {
    ...room,
    number: room.number.trim(),
    name: room.name.trim(),
    num_people: Math.max(0, Math.trunc(room.num_people || 0)),
    num_bedrooms: Math.max(0, Math.trunc(room.num_bedrooms || 0)),
    icfa_factor: clamp(room.icfa_factor || 0, 0, 1),
    notes: room.notes?.trim() || null,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
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
    room.number,
    room.name,
    room.floor_level,
    room.building_zone,
    room.num_people,
    room.num_bedrooms,
    room.icfa_factor,
    room.erv_unit_ids,
    room.catalog_origin,
    room.notes,
  ]);
}

function optionFingerprint(option: SingleSelectOption | undefined): string {
  if (!option) return "";
  return JSON.stringify([option.id, option.label, option.color, option.order]);
}
