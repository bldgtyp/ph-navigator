import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { fetchJson } from "../../shared/api/client";
import type { FieldSchemaMutation } from "../../shared/ui/data-table/lib/customFieldMutations";
import { projectDocumentQueryKeys, projectDocumentTableQueryKeys } from "./query-keys";
import { markLocalDraftTouched } from "./lib";
import type { ProjectDraftSummary } from "./types";

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

export type OnAcceptedTableSlice<TSlice extends BaseTableSlice> = (
  slice: TSlice,
  previous: TableSliceVersionGuard,
) => void | Promise<void>;

// One dependent row a proposed delete would clear (or that would block it).
// Mirrors the backend `CascadePreviewRef`.
export type CascadePreviewRef = {
  table: string;
  row_id: string;
  tag: string;
  field: string;
};

// Dry-run result of a table replace: the optional dependent links the removed
// rows would clear. A required (blocking) link makes `:preview-replace` 409
// instead, exactly as the real write would.
export type TableReplacePreview = {
  affected: CascadePreviewRef[];
};

export type TableReplaceMutationVariables<TSlice, TReplaceBody> = {
  current: TSlice;
  payload: TReplaceBody;
  cachePolicy?: "apply-ack" | "journal-managed";
};

export async function resolveCachedSliceForWrite<TSlice>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  fallback: TSlice,
  refetch: () => Promise<TSlice | null | undefined>,
): Promise<TSlice> {
  if (!queryClient.getQueryState(queryKey)?.isInvalidated) {
    return queryClient.getQueryData<TSlice>(queryKey) ?? fallback;
  }
  return (await refetch()) ?? queryClient.getQueryData<TSlice>(queryKey) ?? fallback;
}

export function refetchResultData<TSlice>(result: unknown): TSlice | null {
  if (!result || typeof result !== "object" || !("data" in result)) return null;
  const data = (result as { data?: unknown }).data;
  return data === undefined ? null : (data as TSlice);
}

export function createTableSliceFeature<TSlice extends BaseTableSlice, TReplaceBody>(options: {
  tableName: string;
  missingVersionMessage: string;
}) {
  const { tableName, missingVersionMessage } = options;

  const queryKeys = {
    all: (projectId: string) => projectDocumentTableQueryKeys.table(projectId, tableName),
    slice: (projectId: string, versionId: string, accessMode: TableSliceAccessMode) =>
      projectDocumentTableQueryKeys.slice(projectId, tableName, versionId, accessMode),
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

  async function previewReplace(
    projectId: string,
    versionId: string,
    current: TSlice,
    payload: TReplaceBody,
  ): Promise<TableReplacePreview> {
    // Dry-run the same replace the real write would do, reporting the dependent
    // links the removed rows would clear (or 409 if a required link blocks it).
    return fetchJson<TableReplacePreview>(
      `/api/v1/projects/${projectId}/versions/${versionId}/draft/tables/${tableName}:preview-replace`,
      {
        method: "POST",
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
      // A slice only changes via an explicit write (which updates the cache
      // through `applyAcceptedSlice`) or invalidation (which marks the query
      // `isInvalidated` so `resolveSliceForWrite` refetches before the next
      // write) — never on its own. `Infinity` stops a mount refetch, which is
      // what lets `useDraftTablesBatchSeed` pre-seed this cache and suppress
      // the per-table fan-out. `isInvalidated` is independent of `staleTime`,
      // so the PR #18 refetch-before-write protocol is unaffected.
      staleTime: Infinity,
    });
  }

  function useReplaceSliceMutation(
    projectId: string,
    versionId: string | null,
    onAcceptedSlice?: OnAcceptedTableSlice<TSlice>,
  ) {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ current, payload }: TableReplaceMutationVariables<TSlice, TReplaceBody>) => {
        if (!versionId) {
          throw new Error(missingVersionMessage);
        }
        return replaceSlice(projectId, versionId, current, payload);
      },
      onSuccess: (slice, variables) =>
        applyAcceptedSlice(
          slice,
          variables.current,
          queryClient,
          projectId,
          tableName,
          onAcceptedSlice,
          variables.cachePolicy !== "journal-managed",
        ),
    });
  }

  function useSchemaMutationMutation(
    projectId: string,
    versionId: string | null,
    onAcceptedSlice?: OnAcceptedTableSlice<TSlice>,
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
        applyAcceptedSlice(
          slice,
          variables.current,
          queryClient,
          projectId,
          tableName,
          onAcceptedSlice,
        ),
    });
  }

  function applyAcceptedSlice(
    slice: TSlice,
    previous: TSlice,
    queryClient: QueryClient,
    projectId: string,
    acceptedTableName: string,
    onAcceptedSlice: OnAcceptedTableSlice<TSlice> | undefined,
    updateAcceptedTableCache = true,
  ): void {
    markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
    if (updateAcceptedTableCache) {
      queryClient.setQueryData(queryKeys.slice(projectId, slice.version_id, "editor"), slice);
    }
    const draftSummaryKey = projectDocumentQueryKeys.draftSummary(projectId, slice.version_id);
    queryClient.setQueryData<ProjectDraftSummary | undefined>(draftSummaryKey, (current) =>
      current
        ? {
            ...current,
            source: "draft",
            draft_etag: slice.draft_etag,
            dirty_tables: Array.from(new Set([...current.dirty_tables, acceptedTableName])),
          }
        : current,
    );
    const sideEffects: Array<Promise<unknown>> = [
      invalidateProjectDocumentEditorTableSlices(queryClient, projectId, slice.version_id, {
        excludeTableName: acceptedTableName,
        refetchActiveSlices: false,
      }),
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.statusSummaries(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.documentationSummaries(projectId),
      }),
    ];
    if (
      onAcceptedSlice &&
      (slice.source !== previous.source || slice.draft_etag !== previous.draft_etag)
    ) {
      sideEffects.push(
        Promise.resolve().then(() =>
          onAcceptedSlice(slice, {
            draftEtag: previous.draft_etag,
            versionEtag: previous.version_etag,
          }),
        ),
      );
    }
    void Promise.all(sideEffects).catch((error: unknown) => {
      console.warn("Non-critical table-write acknowledgement side effect failed.", error);
    });
  }

  return {
    tableName,
    queryKeys,
    fetchSlice,
    replaceSlice,
    previewReplace,
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

export function invalidateProjectDocumentEditorTableSlices(
  queryClient: QueryClient,
  projectId: string,
  versionId: string,
  options: { excludeTableName?: string; refetchActiveSlices?: boolean } = {},
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: projectDocumentTableQueryKeys.project(projectId),
    refetchType: options.refetchActiveSlices === false ? "none" : undefined,
    predicate: (query) =>
      isEditorTableSliceQueryKey(query.queryKey, projectId, versionId, options.excludeTableName),
  });
}

function isEditorTableSliceQueryKey(
  queryKey: readonly unknown[],
  projectId: string,
  versionId: string,
  excludeTableName: string | undefined,
): boolean {
  return (
    queryKey.length === 8 &&
    queryKey[0] === "project-document-tables" &&
    queryKey[1] === "project" &&
    queryKey[2] === projectId &&
    queryKey[3] === "table" &&
    typeof queryKey[4] === "string" &&
    queryKey[4] !== excludeTableName &&
    queryKey[5] === "slice" &&
    queryKey[6] === versionId &&
    queryKey[7] === "editor"
  );
}
