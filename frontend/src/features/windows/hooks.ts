import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectDocumentQueryKeys, projectDocumentTableQueryKeys } from "../project_document/hooks";
import { markLocalDraftTouched } from "../project_document/lib";
import { fetchWindowTypesSlice, replaceWindowTypesSlice } from "./api";
import {
  WINDOW_TYPES_TABLE_NAME,
  type WindowTypesReplacePayload,
  type WindowTypesSlice,
} from "./types";

export const windowTypesQueryKeys = {
  all: (projectId: string) =>
    projectDocumentTableQueryKeys.table(projectId, WINDOW_TYPES_TABLE_NAME),
  slice: (projectId: string, versionId: string, accessMode: "editor" | "viewer") =>
    [...windowTypesQueryKeys.all(projectId), "slice", versionId, accessMode] as const,
};

export function useWindowTypesSliceQuery(
  projectId: string,
  versionId: string | null,
  accessMode: "editor" | "viewer",
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: windowTypesQueryKeys.slice(projectId, resolvedVersionId, accessMode),
    queryFn: ({ signal }) =>
      fetchWindowTypesSlice(projectId, resolvedVersionId, accessMode, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useReplaceWindowTypesSliceMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      current,
      payload,
    }: {
      current: WindowTypesSlice;
      payload: WindowTypesReplacePayload;
    }) => {
      if (!versionId) {
        throw new Error("Cannot update window types without an active project version.");
      }
      return replaceWindowTypesSlice(projectId, versionId, current, payload);
    },
    onSuccess: (slice) => {
      markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
      queryClient.setQueryData(
        windowTypesQueryKeys.slice(projectId, slice.version_id, "editor"),
        slice,
      );
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
      });
    },
  });
}
