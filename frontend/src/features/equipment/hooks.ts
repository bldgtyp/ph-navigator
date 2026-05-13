import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectDocumentQueryKeys, projectDocumentTableQueryKeys } from "../project_document/hooks";
import { fetchRoomsSlice, replaceRoomsSlice } from "./api";
import { ROOMS_TABLE_NAME, type RoomsReplacePayload, type RoomsSlice } from "./types";

const ROOMS_DRAFT_CHANNEL = "phn-rooms-draft-v1";

type RoomsDraftBroadcastMessage = {
  type: "rooms-slice-accepted";
  projectId: string;
  versionId: string;
  previous: RoomsSliceVersionGuard;
  slice: RoomsSlice;
};

type RoomsSliceVersionGuard = {
  draftEtag: string | null;
  versionEtag: string;
};

export const roomsQueryKeys = {
  all: (projectId: string) => projectDocumentTableQueryKeys.table(projectId, ROOMS_TABLE_NAME),
  project: (projectId: string) => roomsQueryKeys.all(projectId),
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

export function useReplaceRoomsSliceMutation(
  projectId: string,
  versionId: string | null,
  onAcceptedSlice?: (slice: RoomsSlice, previous: RoomsSliceVersionGuard) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ current, payload }: { current: RoomsSlice; payload: RoomsReplacePayload }) => {
      if (!versionId) {
        throw new Error("Cannot update Rooms without an active project version.");
      }
      return replaceRoomsSlice(projectId, versionId, current, payload);
    },
    onSuccess: (slice, variables) => {
      queryClient.setQueryData(roomsQueryKeys.slice(projectId, slice.version_id, "editor"), slice);
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
      });
      if (
        slice.source !== variables.current.source ||
        slice.draft_etag !== variables.current.draft_etag
      ) {
        onAcceptedSlice?.(slice, versionGuard(variables.current));
      }
    },
  });
}

export function useRoomsDraftBroadcast(
  projectId: string,
  versionId: string | null,
  enabled: boolean,
  onRemoteSlice: (slice: RoomsSlice) => void,
) {
  const queryClient = useQueryClient();
  const channelRef = useRef<BroadcastChannel | null>(null);
  const onRemoteSliceRef = useRef(onRemoteSlice);

  useEffect(() => {
    onRemoteSliceRef.current = onRemoteSlice;
  }, [onRemoteSlice]);

  useEffect(() => {
    if (!enabled || !versionId || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(ROOMS_DRAFT_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<RoomsDraftBroadcastMessage>) => {
      const message = event.data;
      if (
        message?.type !== "rooms-slice-accepted" ||
        message.projectId !== projectId ||
        message.versionId !== versionId
      ) {
        return;
      }
      const queryKey = roomsQueryKeys.slice(projectId, versionId, "editor");
      const current = queryClient.getQueryData<RoomsSlice>(queryKey);
      if (current && !matchesVersionGuard(current, message.previous)) {
        void queryClient.invalidateQueries({ queryKey });
        void queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.draftSummary(projectId, versionId),
        });
        return;
      }
      queryClient.setQueryData(queryKey, message.slice);
      void queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, versionId),
      });
      onRemoteSliceRef.current(message.slice);
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [enabled, projectId, queryClient, versionId]);

  return useCallback(
    (slice: RoomsSlice, previous: RoomsSliceVersionGuard) => {
      if (!enabled || !versionId) return;
      channelRef.current?.postMessage({
        type: "rooms-slice-accepted",
        projectId,
        versionId,
        previous,
        slice,
      } satisfies RoomsDraftBroadcastMessage);
    },
    [enabled, projectId, versionId],
  );
}

function versionGuard(slice: RoomsSlice): RoomsSliceVersionGuard {
  return {
    draftEtag: slice.draft_etag,
    versionEtag: slice.version_etag,
  };
}

function matchesVersionGuard(slice: RoomsSlice, guard: RoomsSliceVersionGuard): boolean {
  if (guard.draftEtag) {
    return slice.draft_etag === guard.draftEtag;
  }
  return slice.draft_etag === null && slice.version_etag === guard.versionEtag;
}
