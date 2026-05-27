// Rooms-specific formula-field registry helpers.

import type { FieldRegistryEntry } from "../../../shared/ui/data-table";
import { getCustomValue, isBuiltInField } from "../../../shared/ui/data-table";
import { mapToFormulaType } from "../../../shared/ui/data-table/lib/formula/mapToFormulaType";
import type { RoomRow } from "../types";
import { ROOMS_SCHEMA_CORE_FIELD_KEYS } from "../lib";

export function buildRoomsFormulaRegistry(
  fieldDefs: ReadonlyArray<{
    field_key: string;
    display_name: string;
    field_type: string;
    built_in?: boolean;
  }>,
): FieldRegistryEntry[] {
  return fieldDefs.map((fieldDef) => ({
    field_id: fieldDef.field_key,
    display_name: fieldDef.display_name,
    origin: isBuiltInField(fieldDef) ? "core" : "custom",
    field_type: mapToFormulaType(fieldDef.field_type),
  }));
}

// Read a formula-side core value off a RoomRow, mirroring the backend's
// `_read_rooms_core_field_for_formula` so the in-editor live preview
// agrees with the server-side computed overlay. List-valued cores are
// joined with ", " for parity.
export function readRoomsFormulaValue(room: RoomRow, fieldId: string): unknown {
  const customValue = getCustomValue(room, fieldId);
  if (customValue !== undefined) return customValue ?? null;
  const raw = (room as unknown as Record<string, unknown>)[fieldId];
  if (Array.isArray(raw)) return raw.map((v) => String(v)).join(", ");
  if (raw === undefined) return null;
  return raw;
}

export function buildRoomFormulaRowValues(room: RoomRow): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const fieldId of ROOMS_SCHEMA_CORE_FIELD_KEYS) {
    if (fieldId === "custom_values") continue;
    values[fieldId] = readRoomsFormulaValue(room, fieldId);
  }
  for (const [fieldKey, value] of Object.entries(room.custom_values)) {
    values[fieldKey] = value ?? null;
  }
  return values;
}
