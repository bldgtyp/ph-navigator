// Factory for the `buildEmptyRow` consumer callback that <DataTable>
// invokes during Shift+Enter row insert. The anchored branch clones
// from the anchor row (renumbering through `nextFreeRoomNumber`); the
// no-anchor fallback (currently unreachable via Shift+Enter — the
// empty-state branch short-circuits the grid) reads grid defaults
// from `FieldDef.default` and fills the remaining RoomRow fields.

import type { BuildEmptyRow } from "../../../shared/ui/data-table";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  type RoomRow,
  type RoomsSlice,
} from "../types";
import { firstRoomFloorOptionId, nextFreeRoomNumber } from "../lib";

export function makeBuildEmptyRoomRow(roomsSlice: RoomsSlice): BuildEmptyRow<RoomRow> {
  return ({ rowId, fieldDefaults, anchorRow }) => {
    if (anchorRow) {
      return {
        ...anchorRow,
        id: rowId,
        number: nextFreeRoomNumber(roomsSlice.rooms, anchorRow.number),
      };
    }
    return {
      id: rowId,
      number: nextFreeRoomNumber(roomsSlice.rooms, String(fieldDefaults.number ?? "")),
      name: String(fieldDefaults.name ?? "Untitled"),
      floor_level: ((fieldDefaults[ROOM_FLOOR_LEVEL_KEY] as string | null | undefined) ??
        firstRoomFloorOptionId(roomsSlice)) as string | null,
      building_zone: (fieldDefaults[ROOM_BUILDING_ZONE_KEY] as string | null | undefined) ?? null,
      num_people: Number(fieldDefaults.num_people ?? 0),
      num_bedrooms: Number(fieldDefaults.num_bedrooms ?? 0),
      icfa_factor: Number(fieldDefaults.icfa_factor ?? 1),
      erv_unit_ids: [],
      catalog_origin: null,
      notes: null,
      custom: {},
    };
  };
}
