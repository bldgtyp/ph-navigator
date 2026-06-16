import { createTableSliceFeature } from "../project_document/table-slice";
import {
  SPACE_TYPES_TABLE_NAME,
  type SpaceTypesReplacePayload,
  type SpaceTypesSlice,
} from "./types";

export const spaceTypesSliceFeature = createTableSliceFeature<
  SpaceTypesSlice,
  SpaceTypesReplacePayload
>({
  tableName: SPACE_TYPES_TABLE_NAME,
  missingVersionMessage: "Cannot update Space-Types without an active project version.",
});

export const fetchSpaceTypesSlice = spaceTypesSliceFeature.fetchSlice;
export const replaceSpaceTypesSlice = spaceTypesSliceFeature.replaceSlice;
