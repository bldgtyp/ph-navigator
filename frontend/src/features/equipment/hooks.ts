import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import { type TableSliceVersionGuard } from "../project_document/table-slice";
import { roomsSliceFeature } from "./api";
import { roomsQueryKeys } from "./query-keys";
import { type RoomsSlice } from "./types";

const ROOMS_DRAFT_CHANNEL = "phn-rooms-draft-v1";

type RoomsDraftBroadcastMessage = {
  type: "rooms-slice-accepted";
  projectId: string;
  versionId: string;
  previous: TableSliceVersionGuard;
  slice: RoomsSlice;
};

export { roomsQueryKeys };

export const useRoomsSliceQuery = roomsSliceFeature.useSliceQuery;
export const useReplaceRoomsSliceMutation = roomsSliceFeature.useReplaceSliceMutation;
export const useRoomsSchemaMutation = roomsSliceFeature.useSchemaMutationMutation;

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
    (slice: RoomsSlice, previous: TableSliceVersionGuard) => {
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

function matchesVersionGuard(slice: RoomsSlice, guard: TableSliceVersionGuard): boolean {
  if (guard.draftEtag) {
    return slice.draft_etag === guard.draftEtag;
  }
  return slice.draft_etag === null && slice.version_etag === guard.versionEtag;
}
