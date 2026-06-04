// @size-exception: docs/code-reviews/2026-05-25/frontend-code-review.md#21-srp--file-length-violations
import type {
  CustomValue,
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
  PUMP_DEVICE_TYPE_OPTION_KEY,
  ROOM_BUILDING_ZONE_COLUMN_ID,
  ROOM_BUILDING_ZONE_KEY,
  ROOM_BUILDING_ZONE_OPTION_KEY,
  ROOM_FLOOR_LEVEL_COLUMN_ID,
  ROOM_FLOOR_LEVEL_KEY,
  ROOM_FLOOR_LEVEL_OPTION_KEY,
  ROOMS_TABLE_NAME,
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
import {
  customNumberValue,
  customTextValue,
  customTextValueOrNull,
} from "./lib/customValueReaders";
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
  "floor_level",
  "building_zone",
  "icfa_factor",
  "erv_unit_ids",
  "catalog_origin",
  "notes",
  "custom_values",
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

const BUILT_IN_FIELD_CREATED_AT = "2026-05-26T00:00:00Z";

function builtInFieldDef(
  field_key: string,
  display_name: string,
  field_type: TableFieldDef["field_type"],
): TableFieldDef {
  return {
    field_key,
    display_name,
    field_type,
    config: {},
    description: null,
    origin: "built_in",
    created_at: BUILT_IN_FIELD_CREATED_AT,
    created_by: null,
  };
}

export const ROOMS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Record-ID", "formula"),
  builtInFieldDef("number", "Number", "short_text"),
  builtInFieldDef("name", "Name", "short_text"),
  builtInFieldDef(ROOM_FLOOR_LEVEL_KEY, "Floor", "single_select"),
  builtInFieldDef(ROOM_BUILDING_ZONE_KEY, "Zone", "single_select"),
  builtInFieldDef("num_people", "People", "number"),
  builtInFieldDef("num_bedrooms", "Bedrooms", "number"),
  builtInFieldDef("icfa_factor", "iCFA", "number"),
  builtInFieldDef("erv_unit_ids", "ERVs", "long_text"),
];

export const PUMPS_COMPAT_BUILT_IN_FIELD_DEFS: TableFieldDef[] = [
  builtInFieldDef("record_id", "Record-ID", "short_text"),
  builtInFieldDef(PUMP_DEVICE_TYPE_KEY, "Device", "single_select"),
  builtInFieldDef("use", "Use", "short_text"),
  builtInFieldDef("manufacturer", "Manufacturer", "short_text"),
  builtInFieldDef("model", "Model", "short_text"),
  builtInFieldDef("volts", "Volts", "number"),
  builtInFieldDef("phase", "Phase", "number"),
  builtInFieldDef("horse_power", "Horse Power", "number"),
  builtInFieldDef("wattage", "Wattage", "number"),
  builtInFieldDef("flow_gpm", "Flow - GPM", "number"),
  builtInFieldDef("runtime_khr_yr", "Runtime - kHR/YEAR", "number"),
  builtInFieldDef("link", "Link", "url"),
  builtInFieldDef("notes", "Notes", "long_text"),
  builtInFieldDef(PUMP_DATASHEET_FIELD_KEY, "Datasheet", "long_text"),
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
    erv_unit_ids: {
      read_only: true,
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

export function emptyRoom(defaultFloorLevel: string | null = null): RoomRow {
  return {
    id: generatedId(ROOM_ID_PREFIX),
    floor_level: defaultFloorLevel,
    building_zone: null,
    icfa_factor: 1,
    erv_unit_ids: [],
    catalog_origin: null,
    notes: null,
    custom_values: {
      number: "",
      name: "",
      num_people: 0,
      num_bedrooms: 0,
    },
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

// Build a RoomsReplacePayload that removes the rows named by the
// <DataTable> toolbar-delete gesture. Inverse-of-delete (undo)
// dispatches a matching rowInsert; the consumer's buildEmptyRow
// reconstructs each row from extractRowDefaults output.
// AirTable-parity " (copy)" / " (copy N)" suffix resolver. Mirrors
// the backend `next_copy_suffix` in
// `backend/features/catalogs/_shared.py` so CRUD and slice-replace
// consumers behave identically. Lives here today next to its two
// consumers (Rooms, Pumps); promote to `shared/lib/copySuffix.ts` if a
// third TS consumer needs it.
const COPY_SUFFIX_RE = /^(.*?)\s*\(copy(?:\s+(\d+))?\)$/;

export function nextCopySuffix(baseName: string, siblingNames: Iterable<string>): string {
  const match = COPY_SUFFIX_RE.exec(baseName);
  const root = match ? match[1] : baseName;
  const siblings = new Set(siblingNames);
  let candidate = `${root} (copy)`;
  if (!siblings.has(candidate)) return candidate;
  let n = 2;
  while (true) {
    candidate = `${root} (copy ${n})`;
    if (!siblings.has(candidate)) return candidate;
    n += 1;
  }
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
  const rooms = current.rooms.map((room) =>
    applyWritesToRoom(room, writesByRowId.get(room.id) ?? [], customFieldKeys, current.field_defs),
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
    if (room.erv_unit_ids.length > 0) {
      return "ERV assignments are deferred until ERV units are available.";
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
  fieldDefs: readonly Pick<TableFieldDef, "field_key" | "field_type">[],
): RoomRow {
  if (writes.length === 0) return room;
  let next = room;
  for (const write of writes) {
    next = applyWriteToRoom(next, write.fieldKey, write.value, customFieldKeys);
  }
  return normalizeRoomForPayload(next, fieldDefs);
}

function applyWriteToRoom(
  room: RoomRow,
  fieldKey: string,
  value: unknown,
  customFieldKeys: ReadonlySet<string>,
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

function isNullableOptionId(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.startsWith("opt_"));
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

export function isPumpOptionKey(key: string): key is PumpOptionKey {
  return key === PUMP_DEVICE_TYPE_OPTION_KEY;
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

function nullableTrimmed(value: string): string | null {
  return value.trim() || null;
}

function nonNegativeOrNull(value: number | null): number | null {
  if (value === null || value === undefined) return null;
  return Math.max(0, value);
}

function clonePumpOptions(current: PumpsSlice): PumpsReplacePayload["single_select_options"] {
  return {
    [PUMP_DEVICE_TYPE_OPTION_KEY]: [...current.single_select_options[PUMP_DEVICE_TYPE_OPTION_KEY]],
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
    room.floor_level,
    room.building_zone,
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
