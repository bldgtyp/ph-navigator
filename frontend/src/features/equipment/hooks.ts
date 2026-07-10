import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import { type TableSliceVersionGuard } from "../project_document/table-slice";
import {
  appliancesSliceFeature,
  electricHeatersSliceFeature,
  fansSliceFeature,
  hotWaterHeatersSliceFeature,
  hotWaterTanksSliceFeature,
  pumpsSliceFeature,
  roomsSliceFeature,
  thermalBridgesSliceFeature,
  ventilatorsSliceFeature,
} from "./api";
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
export const useAppliancesSliceQuery = appliancesSliceFeature.useSliceQuery;
export const useReplaceAppliancesSliceMutation = appliancesSliceFeature.useReplaceSliceMutation;
export const useAppliancesSchemaMutation = appliancesSliceFeature.useSchemaMutationMutation;
export const useReplaceRoomsSliceMutation = roomsSliceFeature.useReplaceSliceMutation;
export const useRoomsSchemaMutation = roomsSliceFeature.useSchemaMutationMutation;
export const usePumpsSliceQuery = pumpsSliceFeature.useSliceQuery;
export const useReplacePumpsSliceMutation = pumpsSliceFeature.useReplaceSliceMutation;
export const usePumpsSchemaMutation = pumpsSliceFeature.useSchemaMutationMutation;
export const useVentilatorsSliceQuery = ventilatorsSliceFeature.useSliceQuery;
export const useReplaceVentilatorsSliceMutation = ventilatorsSliceFeature.useReplaceSliceMutation;
export const useVentilatorsSchemaMutation = ventilatorsSliceFeature.useSchemaMutationMutation;
export const useThermalBridgesSliceQuery = thermalBridgesSliceFeature.useSliceQuery;
export const useReplaceThermalBridgesSliceMutation =
  thermalBridgesSliceFeature.useReplaceSliceMutation;
export const useThermalBridgesSchemaMutation = thermalBridgesSliceFeature.useSchemaMutationMutation;
export const useFansSliceQuery = fansSliceFeature.useSliceQuery;
export const useReplaceFansSliceMutation = fansSliceFeature.useReplaceSliceMutation;
export const useFansSchemaMutation = fansSliceFeature.useSchemaMutationMutation;
export const useHotWaterHeatersSliceQuery = hotWaterHeatersSliceFeature.useSliceQuery;
export const useReplaceHotWaterHeatersSliceMutation =
  hotWaterHeatersSliceFeature.useReplaceSliceMutation;
export const useHotWaterHeatersSchemaMutation =
  hotWaterHeatersSliceFeature.useSchemaMutationMutation;
export const useHotWaterTanksSliceQuery = hotWaterTanksSliceFeature.useSliceQuery;
export const useReplaceHotWaterTanksSliceMutation =
  hotWaterTanksSliceFeature.useReplaceSliceMutation;
export const useHotWaterTanksSchemaMutation = hotWaterTanksSliceFeature.useSchemaMutationMutation;
export const useElectricHeatersSliceQuery = electricHeatersSliceFeature.useSliceQuery;
export const useReplaceElectricHeatersSliceMutation =
  electricHeatersSliceFeature.useReplaceSliceMutation;
export const useElectricHeatersSchemaMutation =
  electricHeatersSliceFeature.useSchemaMutationMutation;

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
      onRemoteSliceRef.current(message.slice);
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
