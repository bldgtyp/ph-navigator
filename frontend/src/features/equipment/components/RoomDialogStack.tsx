// The two modals stacked behind the rooms grid: the Room edit/add
// modal (`RoomModal`) and the delete confirmation (`ConfirmDeleteRoomDialog`).
// Kept together so RoomsPage's render reads as a thin composer.

import { ConfirmDeleteRoomDialog } from "./ConfirmDeleteRoomDialog";
import { RoomModal } from "./RoomModal";
import { emptyRoom, firstRoomFloorOptionId } from "../lib";
import { customTextValue } from "../lib/customValueReaders";
import type { RoomRow, RoomsSlice } from "../types";

export type RoomModalState = { mode: "add" } | { mode: "edit"; room: RoomRow };

export type RoomDialogStackProps = {
  isEditor: boolean;
  roomsSlice: RoomsSlice;
  roomModal: RoomModalState | null;
  roomPendingDelete: RoomRow | null;
  frozenReason: string | null;
  blockerActive: boolean;
  deletePending: boolean;
  onCancelModal: () => void;
  onSubmitRoom: (
    room: RoomRow,
    labels: { floorLevel: string; buildingZone: string },
  ) => Promise<void>;
  onRequestDelete: (room: RoomRow) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (room: RoomRow) => void;
  onFrozenReload: () => void;
};

export function RoomDialogStack(props: RoomDialogStackProps) {
  const {
    isEditor,
    roomsSlice,
    roomModal,
    roomPendingDelete,
    frozenReason,
    blockerActive,
    deletePending,
    onCancelModal,
    onSubmitRoom,
    onRequestDelete,
    onCancelDelete,
    onConfirmDelete,
    onFrozenReload,
  } = props;
  return (
    <>
      {roomModal && isEditor ? (
        <RoomModal
          key={roomModal.mode === "add" ? "add" : roomModal.room.id}
          title={roomModal.mode === "add" ? "New room" : `Room: ${roomLabel(roomModal.room)}`}
          room={
            roomModal.mode === "add"
              ? emptyRoom(firstRoomFloorOptionId(roomsSlice))
              : roomModal.room
          }
          roomsSlice={roomsSlice}
          onCancel={onCancelModal}
          onSubmit={onSubmitRoom}
          frozenReason={frozenReason}
          onFrozenReload={onFrozenReload}
          onDelete={roomModal.mode === "edit" ? () => onRequestDelete(roomModal.room) : undefined}
          deleteDisabled={blockerActive}
        />
      ) : null}
      {roomPendingDelete ? (
        <ConfirmDeleteRoomDialog
          room={roomPendingDelete}
          pending={deletePending}
          onCancel={onCancelDelete}
          onConfirm={() => onConfirmDelete(roomPendingDelete)}
        />
      ) : null}
    </>
  );
}

function roomLabel(room: RoomRow): string {
  const label = [customTextValue(room, "number"), customTextValue(room, "name")]
    .filter(Boolean)
    .join(" - ");
  return label || room.id;
}
