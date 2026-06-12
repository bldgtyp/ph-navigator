import { useMemo, useState } from "react";
import { useRoomDialogController } from "../lib/useRoomDialogController";
import type { RoomRow, RoomsSlice } from "../types";
import { RoomDialogStack, type RoomModalState } from "./RoomDialogStack";

export type LinkedRoomDialogHostProps = {
  projectId: string;
  activeVersionId: string | null;
  accessMode: "editor" | "viewer";
  versionLocked: boolean;
  roomsSlice: RoomsSlice;
  refetch: () => Promise<unknown>;
  roomId: string;
  onClose: () => void;
};

export function LinkedRoomDialogHost(props: LinkedRoomDialogHostProps) {
  const {
    projectId,
    activeVersionId,
    accessMode,
    versionLocked,
    roomsSlice,
    refetch,
    roomId,
    onClose,
  } = props;
  const isEditor = accessMode === "editor";
  const [roomPendingDelete, setRoomPendingDelete] = useState<RoomRow | null>(null);
  const room = useMemo(
    () => roomsSlice.rooms.find((candidate) => candidate.id === roomId) ?? null,
    [roomId, roomsSlice.rooms],
  );
  const roomModal: RoomModalState | null = room ? { mode: "edit", room } : null;
  const { controller, saveRoom, deleteRoom, frozenReason } = useRoomDialogController({
    projectId,
    activeVersionId,
    accessMode,
    versionLocked,
    roomsSlice,
    refetch,
    activeRoom: room,
    onSaved: onClose,
    onDeleted: () => {
      setRoomPendingDelete(null);
      onClose();
    },
    viewStateEnabled: false,
  });

  const reloadDraft = async () => {
    setRoomPendingDelete(null);
    onClose();
    await controller.reloadDraft();
  };

  return (
    <RoomDialogStack
      isEditor={isEditor}
      roomsSlice={roomsSlice}
      roomModal={roomModal}
      roomPendingDelete={roomPendingDelete}
      frozenReason={frozenReason}
      blockerActive={Boolean(controller.editBlocker)}
      deletePending={controller.isReplacePending}
      onCancelModal={onClose}
      onSubmitRoom={saveRoom}
      onRequestDelete={(selectedRoom) => setRoomPendingDelete(selectedRoom)}
      onCancelDelete={() => setRoomPendingDelete(null)}
      onConfirmDelete={deleteRoom}
      onFrozenReload={() => void reloadDraft()}
    />
  );
}
