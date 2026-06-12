// Wires the broadcast hook + slice mutations together for the
// Rooms page. Returns the two mutation objects RoomsPage passes
// into `useSliceTableController`, plus a `setNotifyRemoteSlice` ref
// setter the route uses after the controller is constructed (the
// controller's `notifyRemoteSlice` callback is created after the
// broadcast hook subscribes, so a ref breaks the declaration cycle).

import { useCallback, useRef } from "react";
import {
  useReplaceRoomsSliceMutation,
  useRoomsDraftBroadcast,
  useRoomsSchemaMutation,
} from "../hooks";
import type { RoomsSlice } from "../types";

export type RoomsSliceWiring = {
  replaceMutation: ReturnType<typeof useReplaceRoomsSliceMutation>;
  schemaMutation: ReturnType<typeof useRoomsSchemaMutation>;
  setNotifyRemoteSlice: (cb: (incoming: RoomsSlice) => void) => void;
};

export function useRoomsSliceWiring(args: {
  projectId: string;
  activeVersionId: string | null;
  isEditor: boolean;
}): RoomsSliceWiring {
  const notifyRemoteSliceRef = useRef<(incoming: RoomsSlice) => void>(() => undefined);
  const onRemoteSlice = useCallback(
    (incoming: RoomsSlice) => notifyRemoteSliceRef.current(incoming),
    [],
  );
  const publishRoomsSlice = useRoomsDraftBroadcast(
    args.projectId,
    args.activeVersionId,
    args.isEditor,
    onRemoteSlice,
  );
  const replaceMutation = useReplaceRoomsSliceMutation(
    args.projectId,
    args.activeVersionId,
    publishRoomsSlice,
  );
  const schemaMutation = useRoomsSchemaMutation(
    args.projectId,
    args.activeVersionId,
    publishRoomsSlice,
  );
  const setNotifyRemoteSlice = useCallback((cb: (incoming: RoomsSlice) => void) => {
    notifyRemoteSliceRef.current = cb;
  }, []);
  return {
    replaceMutation,
    schemaMutation,
    setNotifyRemoteSlice,
  };
}
