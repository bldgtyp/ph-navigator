// Factory for the `buildEmptyRow` consumer callback that <DataTable>
// invokes during Shift+Enter row insert. Per plan-30 D10, Shift-Enter
// creates a truly blank row — the anchor row's *position* still
// matters (the new row inserts below it), but its *values* do not.

import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyRoom, firstRoomFloorOptionId } from "../lib";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  type RoomRow,
  type RoomsSlice,
} from "../types";
import { readNumberDefault, readStringDefault } from "./fieldDefaults";

export function makeBuildEmptyRoomRow(roomsSlice: RoomsSlice): BuildEmptyRow<RoomRow> {
  return ({ rowId, fieldDefaults }) => {
    const base = { ...emptyRoom(firstRoomFloorOptionId(roomsSlice)), id: rowId };
    return {
      ...base,
      number: readStringDefault(fieldDefaults.number, base.number) ?? "",
      name: readStringDefault(fieldDefaults.name, base.name) ?? "",
      floor_level: readStringDefault(fieldDefaults[ROOM_FLOOR_LEVEL_KEY], base.floor_level),
      building_zone: readStringDefault(fieldDefaults[ROOM_BUILDING_ZONE_KEY], base.building_zone),
      num_people: readNumberDefault(fieldDefaults.num_people, base.num_people) ?? 0,
      num_bedrooms: readNumberDefault(fieldDefaults.num_bedrooms, base.num_bedrooms) ?? 0,
      icfa_factor: readNumberDefault(fieldDefaults.icfa_factor, base.icfa_factor) ?? 1,
    };
  };
}
