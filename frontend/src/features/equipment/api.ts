import { createTableSliceFeature } from "../project_document/table-slice";
import {
  PUMPS_TABLE_NAME,
  ROOMS_TABLE_NAME,
  type PumpsReplacePayload,
  type PumpsSlice,
  type RoomsReplacePayload,
  type RoomsSlice,
} from "./types";

export const roomsSliceFeature = createTableSliceFeature<RoomsSlice, RoomsReplacePayload>({
  tableName: ROOMS_TABLE_NAME,
  missingVersionMessage: "Cannot update Rooms without an active project version.",
});

export const fetchRoomsSlice = roomsSliceFeature.fetchSlice;
export const replaceRoomsSlice = roomsSliceFeature.replaceSlice;

export const pumpsSliceFeature = createTableSliceFeature<PumpsSlice, PumpsReplacePayload>({
  tableName: PUMPS_TABLE_NAME,
  missingVersionMessage: "Cannot update Pumps without an active project version.",
});

export const fetchPumpsSlice = pumpsSliceFeature.fetchSlice;
export const replacePumpsSlice = pumpsSliceFeature.replaceSlice;
