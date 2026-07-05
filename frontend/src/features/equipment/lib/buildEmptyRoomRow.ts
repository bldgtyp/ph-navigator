// Factory for the `buildEmptyRow` consumer callback that <DataTable>
// invokes during Shift+Enter row insert. Per plan-30 D10, Shift-Enter
// creates a truly blank row — the anchor row's *position* still
// matters (the new row inserts below it), but its *values* do not.

import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import { emptyRoom, firstRoomFloorOptionId } from "../lib";
import { customNumberValue, customTextValueOrNull } from "./customValueReaders";
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
      floor_level: readStringDefault(fieldDefaults[ROOM_FLOOR_LEVEL_KEY], base.floor_level),
      building_zone: readStringDefault(fieldDefaults[ROOM_BUILDING_ZONE_KEY], base.building_zone),
      icfa_factor: readNumberDefault(fieldDefaults.icfa_factor, base.icfa_factor) ?? 1,
      custom_values: {
        ...base.custom_values,
        number:
          readStringDefault(fieldDefaults.number, customTextValueOrNull(base, "number")) ?? "",
        name: readStringDefault(fieldDefaults.name, customTextValueOrNull(base, "name")) ?? "",
        num_people:
          readNumberDefault(fieldDefaults.num_people, customNumberValue(base, "num_people")) ?? 0,
        num_bedrooms:
          readNumberDefault(fieldDefaults.num_bedrooms, customNumberValue(base, "num_bedrooms")) ??
          0,
        ceiling_height_m: readNumberDefault(
          fieldDefaults.ceiling_height_m,
          customNumberValue(base, "ceiling_height_m"),
        ),
      },
    };
  };
}
