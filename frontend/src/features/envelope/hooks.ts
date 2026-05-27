import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { markLocalDraftTouched } from "../project_document/lib";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import { fetchEnvelopeReadModel, postEnvelopeCommand } from "./api";
import { envelopeQueryKeys } from "./query-keys";
import type { EnvelopeCommand, EnvelopeReadResponse, EnvelopeReadSource } from "./types";

export function useEnvelopeReadQuery(
  projectId: string,
  versionId: string | null,
  source: EnvelopeReadSource,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: envelopeQueryKeys.read(projectId, resolvedVersionId, source),
    queryFn: ({ signal }) => fetchEnvelopeReadModel(projectId, resolvedVersionId, source, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useEnvelopeCommandMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      current,
      command,
    }: {
      current: EnvelopeReadResponse;
      command: EnvelopeCommand;
    }) => {
      if (!versionId) throw new Error("Select a version before editing envelope assemblies.");
      return postEnvelopeCommand(projectId, versionId, current, { command });
    },
    onSuccess: (slice, variables) => {
      queryClient.setQueryData(envelopeQueryKeys.read(projectId, slice.version_id, "draft"), slice);
      if (slice.draft_etag !== variables.current.draft_etag) {
        markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
        });
      }
    },
  });
}
