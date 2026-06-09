import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "../../../shared/api/client";
import { projectDocumentQueryKeys } from "../../project_document/query-keys";
import { draftWriteHeaders } from "../../project_document/table-slice";
import { markLocalDraftTouched } from "../../project_document/lib";
import type {
  HeatPumpPatchOp,
  HeatPumpTableKey,
  HeatPumpsPatchResponse,
  HeatPumpsSlice,
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
    }) =>
      fetchJson<HeatPumpsPatchResponse>(
        `/api/v1/projects/${projectId}/equipment/heat-pumps/${table}`,
        {
          method: "PATCH",
          headers: draftWriteHeaders(current),
          body: JSON.stringify(patch),
        },
      ),
    onSuccess: (slice) => {
      markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
      queryClient.setQueryData(heatPumpsQueryKeys.slice(projectId, "editor"), slice);
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
      });
    },
  });
}
