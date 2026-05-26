import { windowTypesSliceFeature } from "./api";
import { windowTypesQueryKeys } from "./query-keys";

export { windowTypesQueryKeys };
export const useWindowTypesSliceQuery = windowTypesSliceFeature.useSliceQuery;
export const useReplaceWindowTypesSliceMutation = windowTypesSliceFeature.useReplaceSliceMutation;
