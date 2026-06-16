import { spaceTypesSliceFeature } from "./api";
import { spaceTypesQueryKeys } from "./query-keys";

export { spaceTypesQueryKeys };

export const useSpaceTypesSliceQuery = spaceTypesSliceFeature.useSliceQuery;
export const useReplaceSpaceTypesSliceMutation = spaceTypesSliceFeature.useReplaceSliceMutation;
export const useSpaceTypesSchemaMutation = spaceTypesSliceFeature.useSchemaMutationMutation;
