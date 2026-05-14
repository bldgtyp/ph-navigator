import { createTableSliceFeature } from "../project_document/table-slice";
import { ROOMS_TABLE_NAME, type RoomsReplacePayload, type RoomsSlice } from "./types";

export const roomsSliceFeature = createTableSliceFeature<RoomsSlice, RoomsReplacePayload>({
  tableName: ROOMS_TABLE_NAME,
  missingVersionMessage: "Cannot update Rooms without an active project version.",
});

export const fetchRoomsSlice = roomsSliceFeature.fetchSlice;
export const replaceRoomsSlice = roomsSliceFeature.replaceSlice;
