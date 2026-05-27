// Collapse a list of cell-writes targeting a single-select option
// column into the `replacements` map that replaceRoomOptionsPayload
// accepts. Maps each outgoing option id (the room's current value
// before the write) to the new option id the write commits — or null
// when the user is clearing the cell.

import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  ROOM_FLOOR_LEVEL_OPTION_KEY,
  type RoomOptionKey,
  type RoomsSlice,
} from "../types";

export function collapseRoomCellWritesToReplacements(
  slice: RoomsSlice,
  key: RoomOptionKey,
  cellWrites: ReadonlyArray<{ rowId: string; fieldKey: string; value: unknown }> | undefined,
): Record<string, string | null> {
  if (!cellWrites?.length) return {};
  const roomField =
    key === ROOM_FLOOR_LEVEL_OPTION_KEY ? ROOM_FLOOR_LEVEL_KEY : ROOM_BUILDING_ZONE_KEY;
  const replacements: Record<string, string | null> = {};
  for (const write of cellWrites) {
    if (write.fieldKey !== roomField) continue;
    const room = slice.rooms.find((candidate) => candidate.id === write.rowId);
    const previousOptionId = room?.[roomField] ?? null;
    if (previousOptionId) {
      replacements[previousOptionId] = typeof write.value === "string" ? write.value : null;
    }
  }
  return replacements;
}
