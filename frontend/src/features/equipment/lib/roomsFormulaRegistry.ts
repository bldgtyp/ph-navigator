// Rooms-specific formula-field registry helpers. Lives next to
// `roomsController.ts` because the formula field-id mapping is
// feature-specific (the namespaced core single-select column keys
// "rooms.floor_level" / "rooms.building_zone" map to backend formula
// ids "floor_level" / "building_zone").

import type { FieldRegistryEntry } from "../../../shared/ui/data-table";
import { mapToFormulaType } from "../../../shared/ui/data-table/lib/formula/mapToFormulaType";
import { ROOM_BUILDING_ZONE_KEY, ROOM_FLOOR_LEVEL_KEY, type RoomRow } from "../types";
import { ROOMS_SCHEMA_CORE_FIELD_KEYS } from "../lib";

// Maps Rooms FieldDefs (whose `field_key`s use the column-side
// namespaced ids for `rooms.floor_level` / `rooms.building_zone`) onto
// formula-side `field_id`s that match the backend's
// `ROOMS_CORE_FORMULA_TYPES` keys. Custom fields already use the
// formula identity (their `cf_*` id), so the mapping is identity for
// them.
export const ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY: Record<string, string> = {
  [ROOM_FLOOR_LEVEL_KEY]: "floor_level",
  [ROOM_BUILDING_ZONE_KEY]: "building_zone",
};

export function buildRoomsFormulaRegistry(
  fieldDefs: ReadonlyArray<{
    field_key: string;
    display_name: string;
    field_type: string;
    read_only_schema?: boolean;
  }>,
): FieldRegistryEntry[] {
  return fieldDefs.map((fieldDef) => {
    const isCore = fieldDef.read_only_schema === true;
    const fieldId = ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY[fieldDef.field_key] ?? fieldDef.field_key;
    const formulaType = mapToFormulaType(fieldDef.field_type);
    return {
      field_id: fieldId,
      display_name: fieldDef.display_name,
      origin: isCore ? "core" : "custom",
      field_type: formulaType,
    };
  });
}

// Read a formula-side core value off a RoomRow, mirroring the backend's
// `_read_rooms_core_field_for_formula` so the in-editor live preview
// agrees with the server-side computed overlay. List-valued cores are
// joined with ", " for parity.
export function readRoomsFormulaValue(room: RoomRow, fieldId: string): unknown {
  if (fieldId.startsWith("cf_")) {
    return room.custom[fieldId] ?? null;
  }
  const raw = (room as unknown as Record<string, unknown>)[fieldId];
  if (Array.isArray(raw)) return raw.map((v) => String(v)).join(", ");
  if (raw === undefined) return null;
  return raw;
}

export function buildRoomFormulaRowValues(room: RoomRow): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const fieldId of ROOMS_SCHEMA_CORE_FIELD_KEYS) {
    values[fieldId] = readRoomsFormulaValue(room, fieldId);
  }
  for (const [cfId, value] of Object.entries(room.custom)) {
    values[cfId] = value ?? null;
  }
  return values;
}
