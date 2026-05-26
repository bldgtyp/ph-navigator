// Builds the save/delete callbacks RoomsPage passes to RoomModal
// and ConfirmDeleteRoomDialog. Both pipe through the controller's
// `runWithConflictHandling` so the draft-conflict / version-locked
// banners surface on the same code path as the inline cell writes.

import type { SliceTableController } from "../../../shared/ui/data-table/feature";
import type { UseMutationResult } from "@tanstack/react-query";
import { nextRoomsPayload } from "../lib";
import { deleteRoomPayload, roomsPayloadBuilders } from "./roomsController";
import type { RoomRow, RoomsReplacePayload, RoomsSlice } from "../types";

export type RoomReplaceMutation = UseMutationResult<
  RoomsSlice,
  Error,
  { current: RoomsSlice; payload: RoomsReplacePayload }
>;

export function makeSaveRoom(args: {
  controller: SliceTableController<RoomsSlice>;
  roomsSlice: RoomsSlice;
  replaceMutation: RoomReplaceMutation;
  conflictMessage: string;
  onSaved: () => void;
}) {
  const { controller, roomsSlice, replaceMutation, conflictMessage, onSaved } = args;
  return async (room: RoomRow, labels: { floorLevel: string; buildingZone: string }) => {
    await controller.runWithConflictHandling(
      () => {
        const payload = nextRoomsPayload(roomsSlice, room, labels);
        const validation = roomsPayloadBuilders.validate(payload);
        if (validation) {
          controller.setActionError(validation);
          throw new Error(validation);
        }
        return replaceMutation.mutateAsync({ current: roomsSlice, payload });
      },
      conflictMessage,
      "Could not save room.",
    );
    onSaved();
  };
}

export function makeDeleteRoom(args: {
  controller: SliceTableController<RoomsSlice>;
  roomsSlice: RoomsSlice;
  replaceMutation: RoomReplaceMutation;
  conflictMessage: string;
  onDeleted: () => void;
}) {
  const { controller, roomsSlice, replaceMutation, conflictMessage, onDeleted } = args;
  return (room: RoomRow) => {
    if (!controller.canEdit) return;
    void controller
      .runWithConflictHandling(
        () =>
          replaceMutation.mutateAsync({
            current: roomsSlice,
            payload: deleteRoomPayload(roomsSlice, room.id),
          }),
        conflictMessage,
        "Could not delete room.",
      )
      .then(onDeleted)
      .catch(() => undefined);
  };
}
