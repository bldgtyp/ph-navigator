// Builds the save/delete callbacks RoomsPage passes to RoomModal
// and ConfirmDeleteRoomDialog. Both pipe through the controller's
// coordinated write lane so conflict handling and request ordering
// match inline cell writes.

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
  replaceMutation: RoomReplaceMutation;
  conflictMessage: string;
  onSaved: () => void;
}) {
  const { controller, replaceMutation, conflictMessage, onSaved } = args;
  return async (room: RoomRow, labels: { floorLevel: string; buildingZone: string }) => {
    await controller.runCoordinatedWrite(
      {
        label: "rooms:modalSave",
        run: async () => {
          const current = await controller.resolveSliceForWrite();
          const payload = nextRoomsPayload(current, room, labels);
          const validation = roomsPayloadBuilders.validate(payload);
          if (validation) {
            controller.setActionError(validation);
            throw new Error(validation);
          }
          return replaceMutation.mutateAsync({ current, payload });
        },
      },
      conflictMessage,
      "Could not save room.",
    );
    onSaved();
  };
}

export function makeDeleteRoom(args: {
  controller: SliceTableController<RoomsSlice>;
  replaceMutation: RoomReplaceMutation;
  conflictMessage: string;
  onDeleted: () => void;
}) {
  const { controller, replaceMutation, conflictMessage, onDeleted } = args;
  return (room: RoomRow) => {
    if (!controller.canEdit) return;
    void controller
      .runCoordinatedWrite(
        {
          label: "rooms:modalDelete",
          run: async () => {
            const current = await controller.resolveSliceForWrite();
            return replaceMutation.mutateAsync({
              current,
              payload: deleteRoomPayload(current, room.id),
            });
          },
        },
        conflictMessage,
        "Could not delete room.",
      )
      .then(onDeleted)
      .catch(() => undefined);
  };
}
