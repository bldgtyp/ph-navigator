import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { markLocalDraftTouched } from "../project_document/lib";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import { applyApertureCommand, fetchAperturesSlice } from "./api";
import { apertureQueryKeys } from "./query-keys";
import type { ApertureCommand, AperturesSlice } from "./types";

export function useAperturesSliceQuery(
  projectId: string,
  versionId: string | null,
  accessMode: "editor" | "viewer",
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: apertureQueryKeys.slice(projectId, resolvedVersionId, accessMode),
    queryFn: ({ signal }) => fetchAperturesSlice(projectId, resolvedVersionId, accessMode, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useApplyApertureCommandMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ current, command }: { current: AperturesSlice; command: ApertureCommand }) => {
      if (!versionId) {
        throw new Error("Cannot apply an aperture command without an active project version.");
      }
      return applyApertureCommand(projectId, versionId, current, command);
    },
    onSuccess: (slice) => {
      markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
      queryClient.setQueryData(
        apertureQueryKeys.slice(projectId, slice.version_id, "editor"),
        slice,
      );
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
      });
    },
  });
}
