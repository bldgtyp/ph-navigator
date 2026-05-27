import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "../../shared/api/client";
import type { FieldSchemaMutation } from "../../shared/ui/data-table/lib/customFieldMutations";
import { projectDocumentQueryKeys, projectDocumentTableQueryKeys } from "./query-keys";
import { markLocalDraftTouched } from "./lib";

export type TableSliceAccessMode = "editor" | "viewer";

export type BaseTableSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
};

export type TableSliceVersionGuard = {
  draftEtag: string | null;
  versionEtag: string;
};

export function createTableSliceFeature<TSlice extends BaseTableSlice, TReplaceBody>(options: {
  tableName: string;
  missingVersionMessage: string;
}) {
  const { tableName, missingVersionMessage } = options;

  const queryKeys = {
    all: (projectId: string) => projectDocumentTableQueryKeys.table(projectId, tableName),
    slice: (projectId: string, versionId: string, accessMode: TableSliceAccessMode) =>
      [
        ...projectDocumentTableQueryKeys.table(projectId, tableName),
        "slice",
        versionId,
        accessMode,
      ] as const,
  };

  async function fetchSlice(
    projectId: string,
    versionId: string,
    accessMode: TableSliceAccessMode,
    signal?: AbortSignal,
  ): Promise<TSlice> {
    const path =
      accessMode === "editor"
        ? `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/${tableName}`
        : `/api/v1/projects/${projectId}/versions/${versionId}/document/tables/${tableName}`;
    return fetchJson<TSlice>(path, { signal });
  }

  async function replaceSlice(
    projectId: string,
    versionId: string,
    current: TSlice,
    payload: TReplaceBody,
  ): Promise<TSlice> {
    return fetchJson<TSlice>(
      `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/${tableName}`,
      {
        method: "PUT",
        headers: draftWriteHeaders(current),
        body: JSON.stringify(payload),
      },
    );
  }

  async function mutateSchema(
    projectId: string,
    versionId: string,
    current: TSlice,
    mutation: FieldSchemaMutation,
  ): Promise<TSlice> {
    return fetchJson<TSlice>(
      `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/${tableName}/custom-fields:mutate`,
      {
        method: "POST",
        headers: draftWriteHeaders(current),
        body: JSON.stringify(mutation),
      },
    );
  }

  function useSliceQuery(
    projectId: string,
    versionId: string | null,
    accessMode: TableSliceAccessMode,
    enabled = true,
  ) {
    const resolvedVersionId = versionId ?? "";
    return useQuery({
      queryKey: queryKeys.slice(projectId, resolvedVersionId, accessMode),
      queryFn: ({ signal }) => fetchSlice(projectId, resolvedVersionId, accessMode, signal),
      enabled: enabled && resolvedVersionId.length > 0,
    });
  }

  function useReplaceSliceMutation(
    projectId: string,
    versionId: string | null,
    onAcceptedSlice?: (slice: TSlice, previous: TableSliceVersionGuard) => void,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ current, payload }: { current: TSlice; payload: TReplaceBody }) => {
        if (!versionId) {
          throw new Error(missingVersionMessage);
        }
        return replaceSlice(projectId, versionId, current, payload);
      },
      onSuccess: (slice, variables) =>
        applyAcceptedSlice(slice, variables.current, queryClient, projectId, onAcceptedSlice),
    });
  }

  function useSchemaMutationMutation(
    projectId: string,
    versionId: string | null,
    onAcceptedSlice?: (slice: TSlice, previous: TableSliceVersionGuard) => void,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ current, mutation }: { current: TSlice; mutation: FieldSchemaMutation }) => {
        if (!versionId) {
          throw new Error(missingVersionMessage);
        }
        return mutateSchema(projectId, versionId, current, mutation);
      },
      onSuccess: (slice, variables) =>
        applyAcceptedSlice(slice, variables.current, queryClient, projectId, onAcceptedSlice),
    });
  }

  function applyAcceptedSlice(
    slice: TSlice,
    previous: TSlice,
    queryClient: ReturnType<typeof useQueryClient>,
    projectId: string,
    onAcceptedSlice: ((slice: TSlice, previous: TableSliceVersionGuard) => void) | undefined,
  ): void {
    markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
    queryClient.setQueryData(queryKeys.slice(projectId, slice.version_id, "editor"), slice);
    queryClient.invalidateQueries({
      queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
    });
    if (
      onAcceptedSlice &&
      (slice.source !== previous.source || slice.draft_etag !== previous.draft_etag)
    ) {
      onAcceptedSlice(slice, {
        draftEtag: previous.draft_etag,
        versionEtag: previous.version_etag,
      });
    }
  }

  return {
    tableName,
    queryKeys,
    fetchSlice,
    replaceSlice,
    mutateSchema,
    useSliceQuery,
    useReplaceSliceMutation,
    useSchemaMutationMutation,
  };
}

export function draftWriteHeaders(current: BaseTableSlice): Headers {
  const headers = new Headers();
  if (current.draft_etag) {
    headers.set("If-Match", current.draft_etag);
  } else {
    headers.set("If-Match-Version", current.version_etag);
  }
  return headers;
}
