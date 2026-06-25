import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { projectQueryKeys } from "../projects/query-keys";
import { envelopeQueryKeys } from "../envelope/query-keys";
import {
  discardDraft,
  fetchDiff,
  fetchDraftSummary,
  fetchProjectDocument,
  saveDraft,
  saveDraftAs,
} from "./api";
import { projectDocumentQueryKeys, projectDocumentTableQueryKeys } from "./query-keys";
import type { SaveAsPayload } from "./types";

export { projectDocumentQueryKeys, projectDocumentTableQueryKeys };

export async function invalidateProjectDocumentQueries(
  queryClient: QueryClient,
  projectId: string,
  { detail = true, tables = true }: { detail?: boolean; tables?: boolean } = {},
): Promise<void> {
  const invalidations: Array<Promise<void>> = [];
  if (detail) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId) }),
    );
  }
  invalidations.push(queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() }));
  invalidations.push(
    queryClient.invalidateQueries({ queryKey: projectDocumentQueryKeys.project(projectId) }),
  );
  invalidations.push(queryClient.invalidateQueries({ queryKey: envelopeQueryKeys.all(projectId) }));
  if (tables) {
    invalidations.push(
      queryClient.invalidateQueries({ queryKey: projectDocumentTableQueryKeys.project(projectId) }),
    );
  }
  await Promise.all(invalidations);
}

export function useDraftSummaryQuery(projectId: string, versionId: string | null, enabled = true) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: projectDocumentQueryKeys.draftSummary(projectId, resolvedVersionId),
    queryFn: ({ signal }) => fetchDraftSummary(projectId, resolvedVersionId, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useProjectDocumentQuery(
  projectId: string,
  versionId: string | null,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: projectDocumentQueryKeys.document(projectId, resolvedVersionId),
    queryFn: ({ signal }) => fetchProjectDocument(projectId, resolvedVersionId, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useSaveDraftMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ versionEtag }: { versionEtag: string }) =>
      saveDraft(projectId, versionId ?? "", versionEtag),
    onSuccess: () => {
      return invalidateProjectDocumentQueries(queryClient, projectId);
    },
  });
}

export function useSaveDraftAsMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveAsPayload) => saveDraftAs(projectId, versionId ?? "", payload),
    onSuccess: () => {
      return invalidateProjectDocumentQueries(queryClient, projectId);
    },
  });
}

export function useDiscardDraftMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => discardDraft(projectId, versionId ?? ""),
    onSuccess: () => {
      return invalidateProjectDocumentQueries(queryClient, projectId, { detail: false });
    },
  });
}

export function useDiffQuery(
  projectId: string,
  versionId: string | null,
  to: string,
  enabled: boolean,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: projectDocumentQueryKeys.diff(projectId, resolvedVersionId, to),
    queryFn: ({ signal }) => fetchDiff(projectId, resolvedVersionId, to, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}
