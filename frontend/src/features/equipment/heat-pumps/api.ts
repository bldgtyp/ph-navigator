import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "../../../shared/api/client";
import { projectDocumentQueryKeys } from "../../project_document/query-keys";
import { draftWriteHeaders } from "../../project_document/table-slice";
import { markLocalDraftTouched } from "../../project_document/lib";
import type {
  CascadePreview,
  HeatPumpOptionPatchOp,
  HeatPumpOwnedOptionKey,
  HeatPumpPatchOp,
  HeatPumpTableKey,
  HeatPumpsPatchResponse,
  HeatPumpsSlice,
  PhiusExportResponse,
} from "./types";

export const heatPumpsQueryKeys = {
  all: (projectId: string) => ["projects", projectId, "equipment", "heat-pumps"] as const,
  slice: (projectId: string, accessMode: string) =>
    [...heatPumpsQueryKeys.all(projectId), "slice", accessMode] as const,
};

export function useHeatPumpsQuery(
  projectId: string,
  enabled: boolean,
  accessMode: "editor" | "viewer",
) {
  return useQuery({
    queryKey: heatPumpsQueryKeys.slice(projectId, accessMode),
    queryFn: ({ signal }) => fetchHeatPumps(projectId, signal),
    enabled,
  });
}

async function fetchHeatPumps(projectId: string, signal?: AbortSignal): Promise<HeatPumpsSlice> {
  return fetchJson<HeatPumpsSlice>(`/api/v1/projects/${projectId}/equipment/heat-pumps`, {
    signal,
  });
}

export function useHeatPumpPatchMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      current,
      table,
      patch,
    }: {
      current: HeatPumpsSlice;
      table: HeatPumpTableKey;
      patch: HeatPumpPatchOp;
    }) => {
      // Read the freshest cached slice so cross-table edits (e.g. an
      // indoor-units PATCH followed by an outdoor-units PATCH from a
      // sibling sub-tab) don't fire with the previous render's etags.
      const fresh =
        queryClient.getQueryData<HeatPumpsSlice>(heatPumpsQueryKeys.slice(projectId, "editor")) ??
        current;
      return fetchJson<HeatPumpsPatchResponse>(
        `/api/v1/projects/${projectId}/equipment/heat-pumps/${table}`,
        {
          method: "PATCH",
          headers: draftWriteHeaders(fresh),
          body: JSON.stringify(patch),
        },
      );
    },
    onSuccess: (slice) => {
      markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
      queryClient.setQueryData(heatPumpsQueryKeys.slice(projectId, "editor"), slice);
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
      });
    },
  });
}

/**
 * Issues a `?dry-run=true` delete to surface the cascade preview *before* the
 * user confirms a destructive cascade. Cache is untouched — the real delete is
 * a separate call through `useHeatPumpPatchMutation`.
 */
export async function previewHeatPumpDelete(
  projectId: string,
  current: HeatPumpsSlice,
  table: HeatPumpTableKey,
  rowId: string,
): Promise<CascadePreview> {
  const response = await fetchJson<HeatPumpsPatchResponse>(
    `/api/v1/projects/${projectId}/equipment/heat-pumps/${table}?dry-run=true`,
    {
      method: "PATCH",
      headers: draftWriteHeaders(current),
      body: JSON.stringify({ op: "remove", path: `/${rowId}` }),
    },
  );
  return response.cascade_preview ?? { affected: [] };
}

/**
 * Mutates one of the heat-pumps-owned single-select option lists. The backend
 * validates uniqueness + format; the same draft-etag dance as row patches
 * guards against stale writes. On success we refresh the slice in-place so
 * the new option is immediately visible to every consumer (SingleSelectPopover,
 * column accessors, modals).
 */
export function useHeatPumpOptionMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      current,
      optionKey,
      patch,
    }: {
      current: HeatPumpsSlice;
      optionKey: HeatPumpOwnedOptionKey;
      patch: HeatPumpOptionPatchOp;
    }) => {
      const fresh =
        queryClient.getQueryData<HeatPumpsSlice>(heatPumpsQueryKeys.slice(projectId, "editor")) ??
        current;
      return fetchJson<HeatPumpsSlice>(
        `/api/v1/projects/${projectId}/equipment/heat-pumps/options/${optionKey}`,
        {
          method: "PATCH",
          headers: draftWriteHeaders(fresh),
          body: JSON.stringify(patch),
        },
      );
    },
    onSuccess: (slice) => {
      markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
      queryClient.setQueryData(heatPumpsQueryKeys.slice(projectId, "editor"), slice);
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
      });
    },
  });
}

export async function requestPhiusExport(projectId: string): Promise<PhiusExportResponse> {
  return fetchJson<PhiusExportResponse>(
    `/api/v1/projects/${projectId}/equipment/heat-pumps/export-phius`,
    { method: "POST" },
  );
}
