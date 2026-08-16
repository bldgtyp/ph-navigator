import { createTableSliceFeature } from "../../project_document/table-slice";
import {
  APERTURE_INSTALL_TYPES_TABLE_NAME,
  type InstallTypesReplacePayload,
  type InstallTypesSlice,
} from "./types";

export const installTypesSliceFeature = createTableSliceFeature<
  InstallTypesSlice,
  InstallTypesReplacePayload
>({
  tableName: APERTURE_INSTALL_TYPES_TABLE_NAME,
  missingVersionMessage: "Cannot update Installs without an active project version.",
});

export const useInstallTypesSliceQuery = installTypesSliceFeature.useSliceQuery;
export const useReplaceInstallTypesSliceMutation = installTypesSliceFeature.useReplaceSliceMutation;
export const useInstallTypesSchemaMutation = installTypesSliceFeature.useSchemaMutationMutation;
