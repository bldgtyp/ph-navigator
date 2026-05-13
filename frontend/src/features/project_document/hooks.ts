import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { projectQueryKeys } from "../projects/query-keys";
import {
  discardDraft,
  fetchDiff,
  fetchDraftSummary,
  fetchProjectDocument,
  saveDraft,
  saveDraftAs,
} from "./api";
import type { SaveAsPayload } from "./types";

export const projectDocumentQueryKeys = {
  all: ["project-document"] as const,
  project: (projectId: string) => [...projectDocumentQueryKeys.all, "project", projectId] as const,
  draftSummary: (projectId: string, versionId: string) =>
    [...projectDocumentQueryKeys.project(projectId), "draft-summary", versionId] as const,
  document: (projectId: string, versionId: string) =>
    [...projectDocumentQueryKeys.project(projectId), "document", versionId] as const,
  diff: (projectId: string, versionId: string, to: string) =>
    [...projectDocumentQueryKeys.project(projectId), "diff", versionId, to] as const,
};

export const projectDocumentTableQueryKeys = {
  all: ["project-document-tables"] as const,
  project: (projectId: string) =>
    [...projectDocumentTableQueryKeys.all, "project", projectId] as const,
  table: (projectId: string, tableName: string) =>
    [...projectDocumentTableQueryKeys.project(projectId), "table", tableName] as const,
};

export function invalidateProjectDocumentQueries(
  queryClient: QueryClient,
  projectId: string,
  { detail = true, tables = true }: { detail?: boolean; tables?: boolean } = {},
) {
  if (detail) {
    queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId) });
  }
  queryClient.invalidateQueries({ queryKey: projectQueryKeys.list() });
  queryClient.invalidateQueries({ queryKey: projectDocumentQueryKeys.project(projectId) });
  if (tables) {
    queryClient.invalidateQueries({ queryKey: projectDocumentTableQueryKeys.project(projectId) });
  }
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
      invalidateProjectDocumentQueries(queryClient, projectId);
    },
  });
}

export function useSaveDraftAsMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveAsPayload) => saveDraftAs(projectId, versionId ?? "", payload),
    onSuccess: () => {
      invalidateProjectDocumentQueries(queryClient, projectId);
    },
  });
}

export function useDiscardDraftMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => discardDraft(projectId, versionId ?? ""),
    onSuccess: () => {
      invalidateProjectDocumentQueries(queryClient, projectId, { detail: false });
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
