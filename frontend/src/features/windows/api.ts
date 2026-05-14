import { createTableSliceFeature } from "../project_document/table-slice";
import {
  WINDOW_TYPES_TABLE_NAME,
  type WindowTypesReplacePayload,
  type WindowTypesSlice,
} from "./types";

export const windowTypesSliceFeature = createTableSliceFeature<
  WindowTypesSlice,
  WindowTypesReplacePayload
>({
  tableName: WINDOW_TYPES_TABLE_NAME,
  missingVersionMessage: "Cannot update window types without an active project version.",
});

export const fetchWindowTypesSlice = windowTypesSliceFeature.fetchSlice;
export const replaceWindowTypesSlice = windowTypesSliceFeature.replaceSlice;
