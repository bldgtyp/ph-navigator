// SlicePayloadBuilders binding for the Rooms slice. Adapts the
// existing `roomsPayloadFrom*` / `replaceRoomOptionsPayload` helpers
// to the generic SlicePayloadBuilders<TSlice, TRow, TPayload>
// interface that `useSliceTableController` consumes.

import type { RoomOptionKey, RoomRow, RoomsReplacePayload, RoomsSlice } from "../types";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import {
  deleteRoomPayload,
  isRoomOptionKey,
  remoteSliceChangesActiveRoom,
  replaceRoomOptionsPayload,
  roomsPayloadFromCellWrites,
  roomsPayloadFromRowDelete,
  roomsPayloadFromRowDuplicate,
  roomsPayloadFromRowInsert,
  validateRoomsPayload,
} from "../lib";
import { collapseRoomCellWritesToReplacements } from "./collapseRoomCellWritesToReplacements";

export const roomsPayloadBuilders: SlicePayloadBuilders<RoomsSlice, RoomRow, RoomsReplacePayload> =
  {
    rows: (slice) => slice.rooms,
    fromCellWrites(slice, writes, newOptions, removedOptions) {
      return roomsPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
    },
    fromRowInsert(slice, rows, build) {
      return roomsPayloadFromRowInsert(slice, rows, build);
    },
    fromRowDelete(slice, rows) {
      return roomsPayloadFromRowDelete(slice, rows);
    },
    fromRowDuplicate(slice, rows) {
      return roomsPayloadFromRowDuplicate(slice, rows);
    },
    validate(payload) {
      return validateRoomsPayload(payload);
    },
    replaceOptions(slice, optionKey, options, replacements) {
      return replaceRoomOptionsPayload(slice, optionKey as RoomOptionKey, options, replacements);
    },
    remoteSliceChangesActiveRow(slice, incoming, activeRow) {
      return remoteSliceChangesActiveRoom(slice, incoming, activeRow);
    },
    collapseCellWritesToReplacements(slice, optionKey, cellWrites) {
      if (!isRoomOptionKey(optionKey)) return {};
      return collapseRoomCellWritesToReplacements(slice, optionKey, cellWrites);
    },
    isLegacyOptionKey(key) {
      return isRoomOptionKey(key);
    },
  };

// Re-export the row-delete payload shape so RoomsPage can call the
// modal "Delete room" handler without round-tripping through the
// controller's write op.
export { deleteRoomPayload };
