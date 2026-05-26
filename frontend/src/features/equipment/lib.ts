// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
import type {
  PumpOptionKey,
  PumpRow,
  PumpsReplacePayload,
  PumpsSlice,
  RoomOptionKey,
  RoomRow,
  RoomsReplacePayload,
  RoomsSlice,
  SingleSelectOption,
} from "./types";
import {
  PUMP_DATASHEET_FIELD_KEY,
  PUMP_DEVICE_TYPE_COLUMN_ID,
  PUMP_DEVICE_TYPE_KEY,
  ROOM_BUILDING_ZONE_COLUMN_ID,
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_COLUMN_ID,
  ROOM_FLOOR_LEVEL_KEY,
} from "./types";
import type {
  BuildEmptyRow,
  DataTableColumnDef,
  FieldDef,
  FieldOption,
  RowDeletePayload,
  RowInsertPayload,
} from "../../shared/ui/data-table";
import {
  ALL_FIELD_LOCKS,
  DEFAULT_BUILT_IN_LOCKS,
  isCustomFieldKey,
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

type RoomCellWrite = { rowId: string; fieldKey: string; value: unknown };
type PumpCellWrite = { rowId: string; fieldKey: string; value: unknown };

// Namespace prefix for custom single-select option lists scoped to the
// Rooms table. Mirrors backend `option_list_key((ROOMS_TABLE_NAME,), cf_id)`.
const ROOMS_CUSTOM_OPTION_PREFIX = "rooms.cf_";

export const ROOMS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  "number",
  "name",
  "floor_level",
  "building_zone",
  "num_people",
  "num_bedrooms",
  "icfa_factor",
  "erv_unit_ids",
  "catalog_origin",
  "notes",
] as const;

export const PUMPS_SCHEMA_CORE_FIELD_KEYS = [
  "id",
  "device_type",
  "use",
  "tag",
  "manufacturer",
  "model",
  "volts",
  "phase",
  "horse_power",
  "wattage",
  "flow_gpm",
  "runtime_khr_yr",
  "notes",
  "link",
  PUMP_DATASHEET_FIELD_KEY,
] as const;

// Shared by RoomsTable (renderer) and useProjectTableViewState (sanitizer)
// so view-state persistence doesn't depend on the live React tree.
export function roomsTableFieldDefs(roomsSlice: RoomsSlice): FieldDef[] {
  return [
    {
      field_key: "number",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Number",
      required: true,
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "name",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Name",
      required: true,
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: ROOM_FLOOR_LEVEL_KEY,
      field_type: "single_select",
      custom_field_type: "single_select",
      display_name: "Floor",
      required: true,
      options: roomsSlice.single_select_options[ROOM_FLOOR_LEVEL_KEY],
      built_in: true,
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    {
      field_key: ROOM_BUILDING_ZONE_KEY,
      field_type: "single_select",
      custom_field_type: "single_select",
      display_name: "Zone",
      options: roomsSlice.single_select_options[ROOM_BUILDING_ZONE_KEY],
      built_in: true,
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    {
      field_key: "num_people",
      field_type: "number",
      custom_field_type: "number",
      display_name: "People",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "num_bedrooms",
      field_type: "number",
      custom_field_type: "number",
      display_name: "Bedrooms",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      // icfa_factor ∈ [0, 1] — domain invariant doesn't survive a retype.
      field_key: "icfa_factor",
      field_type: "number",
      custom_field_type: "number",
      display_name: "iCFA",
      built_in: true,
      locked: ["field_type", "delete", "duplicate"],
    },
    {
      field_key: "erv_unit_ids",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "ERVs",
      read_only: true,
      built_in: true,
      locked: ["field_type", "delete", "duplicate"],
    },
  ];
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

export function pumpsTableFieldDefs(pumpsSlice: PumpsSlice): FieldDef[] {
  return [
    {
      field_key: PUMP_DEVICE_TYPE_KEY,
      field_type: "single_select",
      custom_field_type: "single_select",
      display_name: "Device Type",
      options: pumpsSlice.single_select_options[PUMP_DEVICE_TYPE_KEY],
      built_in: true,
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    {
      field_key: "use",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Use",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "tag",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Tag",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "manufacturer",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Manufacturer",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "model",
      field_type: "text",
      custom_field_type: "short_text",
      display_name: "Model",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "volts",
      field_type: "number",
      custom_field_type: "number",
      display_name: "Volts",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      // phase ∈ {1, 3} — row validator enforces it; doesn't survive retype.
      field_key: "phase",
      field_type: "number",
      custom_field_type: "number",
      display_name: "Phase",
      built_in: true,
      locked: ["field_type", "delete", "duplicate"],
    },
    {
      field_key: "horse_power",
      field_type: "number",
      custom_field_type: "number",
      display_name: "Horse Power",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "wattage",
      field_type: "number",
      custom_field_type: "number",
      display_name: "Wattage",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "flow_gpm",
      field_type: "number",
      custom_field_type: "number",
      display_name: "Flow - GPM",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "runtime_khr_yr",
      field_type: "number",
      custom_field_type: "number",
      display_name: "Runtime - kHR/YEAR",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      field_key: "notes",
      field_type: "text",
      custom_field_type: "long_text",
      display_name: "Notes",
      built_in: true,
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    {
      // URL validator runs at the cell-write boundary; retype would lose it.
      field_key: "link",
      field_type: "text",
      custom_field_type: "url",
      display_name: "Link",
      built_in: true,
      locked: ["field_type", "delete", "duplicate"],
    },
    {
      field_key: PUMP_DATASHEET_FIELD_KEY,
      field_type: "attachment",
      display_name: "Datasheet",
      built_in: true,
      locked: ALL_FIELD_LOCKS,
    },
  ];
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

export function emptyPump(): PumpRow {
  return {
    id: generatedId(PUMP_ID_PREFIX),
    device_type: null,
    use: null,
    tag: null,
    manufacturer: null,
    model: null,
    volts: null,
    phase: null,
    horse_power: null,
    wattage: null,
    flow_gpm: null,
    runtime_khr_yr: null,
    notes: null,
    link: null,
    datasheet_asset_ids: [],
  };
}

export function emptyRoom(defaultFloorLevel: string | null = null): RoomRow {
  return {
    id: generatedId(ROOM_ID_PREFIX),
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
    custom: {},
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

export function sortedPumps(pumps: PumpRow[]): PumpRow[] {
  return [...pumps].sort((a, b) => {
    const primary = (a.tag ?? a.use ?? a.id).localeCompare(b.tag ?? b.use ?? b.id, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (primary !== 0) return primary;
    return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: "base" });
  });
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
    custom_fields: [...current.custom_fields],
  };
}

export function deleteRoomPayload(current: RoomsSlice, roomId: string): RoomsReplacePayload {
  return {
    rooms: current.rooms.filter((room) => room.id !== roomId),
    single_select_options: cloneOptions(current),
    custom_fields: [...current.custom_fields],
  };
}

// Build a RoomsReplacePayload that adds the rows synthesized by the
// <DataTable> Shift+Enter gesture. The consumer's buildEmptyRow has
// already expanded fieldDefaults into a full RoomRow — this helper
// just merges into the current rooms list and clones options
// unchanged.
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
  return {
    rooms: sortedRooms([...current.rooms, ...built]),
    single_select_options: cloneOptions(current),
    custom_fields: [...current.custom_fields],
  };
}

// Build a RoomsReplacePayload that removes the rows named by the
// <DataTable> toolbar-delete gesture. Inverse-of-delete (undo)
// dispatches a matching rowInsert; the consumer's buildEmptyRow
// reconstructs each row from extractRowDefaults output.
export function roomsPayloadFromRowDelete(
  current: RoomsSlice,
  deletes: RowDeletePayload[],
): RoomsReplacePayload {
  const toDelete = new Set(deletes.map((entry) => entry.rowId));
  return {
    rooms: current.rooms.filter((room) => !toDelete.has(room.id)),
    single_select_options: cloneOptions(current),
    custom_fields: [...current.custom_fields],
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
    if (!isRoomsOptionListKey(fieldKey) || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    const currentList = options[fieldKey] ?? [];
    options[fieldKey] = normalizeOptionOrders(
      currentList.filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    if (!isRoomsOptionListKey(fieldKey)) continue;
    const currentList = options[fieldKey] ?? [];
    options[fieldKey] = normalizeOptionOrders([...currentList, ...createdOptions]);
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
  const customFieldIds = new Set(current.custom_fields.map((field) => field.id));
  const rooms = current.rooms.map((room) =>
    applyWritesToRoom(room, writesByRowId.get(room.id) ?? [], customFieldIds),
  );
  return {
    rooms: sortedRooms(rooms),
    single_select_options: options,
    custom_fields: [...current.custom_fields],
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
    if (!isPumpOptionKey(fieldKey) || removedIds.length === 0) continue;
    const remove = new Set(removedIds);
    options[fieldKey] = normalizeOptionOrders(
      options[fieldKey].filter((option) => !remove.has(option.id)),
    );
  }
  for (const [fieldKey, createdOptions] of Object.entries(newOptions)) {
    if (!isPumpOptionKey(fieldKey)) continue;
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
  }, new Map<string, PumpCellWrite[]>());
  const pumps = current.pumps.map((pump) =>
    applyWritesToPump(pump, writesByRowId.get(pump.id) ?? []),
  );
  return {
    pumps: sortedPumps(pumps),
    single_select_options: options,
  };
}

export function validateRoomsPayload(payload: RoomsReplacePayload): string | null {
  const floorOptionIds = new Set(
    payload.single_select_options[ROOM_FLOOR_LEVEL_KEY].map((option) => option.id),
  );
  const zoneOptionIds = new Set(
    payload.single_select_options[ROOM_BUILDING_ZONE_KEY].map((option) => option.id),
  );
  for (const room of payload.rooms) {
    if (!room.number.trim()) return "Room number is required.";
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

export function validatePumpsPayload(payload: PumpsReplacePayload): string | null {
  const ids = new Set<string>();
  const deviceTypeIds = new Set(
    payload.single_select_options[PUMP_DEVICE_TYPE_KEY].map((option) => option.id),
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
    rooms: sortedRooms(rooms),
    single_select_options: options,
    custom_fields: [...current.custom_fields],
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
    optionChanged(current, incoming, ROOM_FLOOR_LEVEL_KEY, room.floor_level) ||
    optionChanged(current, incoming, ROOM_BUILDING_ZONE_KEY, room.building_zone)
  );
}

function cloneOptions(current: RoomsSlice): RoomsReplacePayload["single_select_options"] {
  // Spread the full record so namespaced custom single-select lists
  // (`rooms.cf_*`) round-trip through every whole-table replace path.
  // Without this, plan-16 P3.5 custom single_select fields would lose
  // their option lists on the next cell / row / option mutation.
  const out: RoomsReplacePayload["single_select_options"] = {
    [ROOM_FLOOR_LEVEL_KEY]: [...current.single_select_options[ROOM_FLOOR_LEVEL_KEY]],
    [ROOM_BUILDING_ZONE_KEY]: [...current.single_select_options[ROOM_BUILDING_ZONE_KEY]],
  };
  for (const [key, list] of Object.entries(current.single_select_options)) {
    if (key === ROOM_FLOOR_LEVEL_KEY || key === ROOM_BUILDING_ZONE_KEY) continue;
    out[key] = [...list];
  }
  return out;
}

function applyWritesToRoom(
  room: RoomRow,
  writes: RoomCellWrite[],
  customFieldIds: ReadonlySet<string>,
): RoomRow {
  if (writes.length === 0) return room;
  let next = room;
  for (const write of writes) {
    next = applyWriteToRoom(next, write.fieldKey, write.value, customFieldIds);
  }
  return normalizeRoomForPayload(next);
}

function applyWriteToRoom(
  room: RoomRow,
  fieldKey: string,
  value: unknown,
  customFieldIds: ReadonlySet<string>,
): RoomRow {
  if (isCustomFieldKey(fieldKey)) {
    // Schema-drift guard: an unknown `cf_*` cannot land in `row.custom`
    // — backend validation would reject it and the cell would have no
    // column. Returning unchanged is the same shape we get for any
    // other unrecognized field key.
    if (!customFieldIds.has(fieldKey)) return room;
    return setCustomValue(room, { field_key: fieldKey }, value);
  }
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

function applyWritesToPump(pump: PumpRow, writes: PumpCellWrite[]): PumpRow {
  if (writes.length === 0) return pump;
  let next = pump;
  for (const write of writes) {
    next = applyWriteToPump(next, write.fieldKey, write.value);
  }
  return normalizePumpForPayload(next);
}

function applyWriteToPump(pump: PumpRow, fieldKey: string, value: unknown): PumpRow {
  if (fieldKey === PUMP_DEVICE_TYPE_KEY && isNullableOptionId(value)) {
    return { ...pump, device_type: value };
  }
  if (
    ["use", "tag", "manufacturer", "model", "notes", "link"].includes(fieldKey) &&
    (value === null || typeof value === "string")
  ) {
    return { ...pump, [fieldKey]: value };
  }
  if (
    ["volts", "phase", "horse_power", "wattage", "flow_gpm", "runtime_khr_yr"].includes(fieldKey) &&
    isNullableNumber(value)
  ) {
    return { ...pump, [fieldKey]: value };
  }
  if (fieldKey === PUMP_DATASHEET_FIELD_KEY) {
    return { ...pump, datasheet_asset_ids: readAttachmentAssetIds(value) };
  }
  return pump;
}

function isNullableOptionId(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.startsWith("opt_"));
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

export function isPumpOptionKey(key: string): key is PumpOptionKey {
  return key === PUMP_DEVICE_TYPE_KEY;
}

export function isRoomOptionKey(key: string): key is RoomOptionKey {
  return key === ROOM_FLOOR_LEVEL_KEY || key === ROOM_BUILDING_ZONE_KEY;
}

// Broader than `isRoomOptionKey`: accepts the two core rooms option
// keys plus any namespaced custom single-select list under the
// `rooms.cf_*` prefix. Used by cell-write payloads where
// `newOptions` / `removedOptions` may target a custom single_select.
function isRoomsOptionListKey(key: string): boolean {
  return isRoomOptionKey(key) || key.startsWith(ROOMS_CUSTOM_OPTION_PREFIX);
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

function normalizePumpForPayload(pump: PumpRow): PumpRow {
  const phase =
    pump.phase === null || pump.phase === undefined ? null : Math.trunc(Number(pump.phase));
  return {
    ...pump,
    use: pump.use?.trim() || null,
    tag: pump.tag?.trim() || null,
    manufacturer: pump.manufacturer?.trim() || null,
    model: pump.model?.trim() || null,
    volts: nonNegativeOrNull(pump.volts),
    phase: phase === 1 || phase === 3 ? phase : pump.phase,
    horse_power: nonNegativeOrNull(pump.horse_power),
    wattage: nonNegativeOrNull(pump.wattage),
    flow_gpm: nonNegativeOrNull(pump.flow_gpm),
    runtime_khr_yr: nonNegativeOrNull(pump.runtime_khr_yr),
    notes: pump.notes?.trim() || null,
    link: pump.link?.trim() || null,
    datasheet_asset_ids: readAttachmentAssetIds(pump.datasheet_asset_ids),
  };
}

function nonNegativeOrNull(value: number | null): number | null {
  if (value === null || value === undefined) return null;
  return Math.max(0, value);
}

function clonePumpOptions(current: PumpsSlice): PumpsReplacePayload["single_select_options"] {
  return {
    [PUMP_DEVICE_TYPE_KEY]: [...current.single_select_options[PUMP_DEVICE_TYPE_KEY]],
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
