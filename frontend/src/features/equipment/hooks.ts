import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRoomsSlice, replaceRoomsSlice } from "./api";
import type { RoomsReplacePayload, RoomsSlice } from "./types";

export const roomsQueryKeys = {
  all: ["rooms"] as const,
  project: (projectId: string) => [...roomsQueryKeys.all, "project", projectId] as const,
  slice: (projectId: string, versionId: string, accessMode: "editor" | "viewer") =>
    [...roomsQueryKeys.project(projectId), "slice", versionId, accessMode] as const,
};

export function useRoomsSliceQuery(
  projectId: string,
  versionId: string | null,
  accessMode: "editor" | "viewer",
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: roomsQueryKeys.slice(projectId, resolvedVersionId, accessMode),
    queryFn: ({ signal }) => fetchRoomsSlice(projectId, resolvedVersionId, accessMode, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useReplaceRoomsSliceMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ current, payload }: { current: RoomsSlice; payload: RoomsReplacePayload }) =>
      replaceRoomsSlice(projectId, versionId ?? "", current, payload),
    onSuccess: (slice) => {
      queryClient.setQueryData(roomsQueryKeys.slice(projectId, slice.version_id, "editor"), slice);
    },
  });
}
