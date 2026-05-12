import { useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import type { ProjectDetail } from "../../projects/types";
import { RoomModal } from "../components/RoomModal";
import { RoomsTable } from "../components/RoomsTable";
import { useReplaceRoomsSliceMutation, useRoomsSliceQuery } from "../hooks";
import { deleteRoomPayload, emptyRoom, nextRoomsPayload } from "../lib";
import type { RoomRow } from "../types";

type RoomModalState = { mode: "add" } | { mode: "edit"; room: RoomRow };

export function EquipmentTab({ project }: { project: ProjectDetail }) {
  const roomsQuery = useRoomsSliceQuery(project.id, project.active_version_id, project.access_mode);
  const replaceRoomsMutation = useReplaceRoomsSliceMutation(project.id, project.active_version_id);
  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const isEditor = project.access_mode === "editor";

  if (roomsQuery.isLoading) {
    return (
      <section className="tab-panel" aria-labelledby="equipment-title">
        <h2 id="equipment-title">Equipment</h2>
        <p>Loading rooms...</p>
      </section>
    );
  }

  if (roomsQuery.isError || !roomsQuery.data) {
    return (
      <section className="tab-panel" aria-labelledby="equipment-title">
        <h2 id="equipment-title">Equipment</h2>
        <p role="alert">{errorMessage(roomsQuery.error, "Could not load rooms.")}</p>
      </section>
    );
  }

  const roomsSlice = roomsQuery.data;
  const saveRoom = async (room: RoomRow, labels: { floorLevel: string; buildingZone: string }) => {
    setActionError(null);
    const payload = nextRoomsPayload(roomsSlice, room, labels);
    await replaceRoomsMutation.mutateAsync({ current: roomsSlice, payload });
    setRoomModal(null);
  };

  const deleteRoom = (room: RoomRow) => {
    if (!window.confirm(`Delete room ${room.number}?`)) return;
    setActionError(null);
    replaceRoomsMutation.mutate(
      { current: roomsSlice, payload: deleteRoomPayload(roomsSlice, room.id) },
      {
        onError: (error) => setActionError(errorMessage(error, "Could not delete room.")),
      },
    );
  };

  return (
    <section className="tab-panel equipment-panel" aria-labelledby="equipment-title">
      <div className="status-heading">
        <div>
          <h2 id="equipment-title">Equipment</h2>
          <p>Rooms are the PHN-first source of truth for downstream HBJSON.</p>
        </div>
        {isEditor ? (
          <button type="button" onClick={() => setRoomModal({ mode: "add" })}>
            Add room
          </button>
        ) : null}
      </div>
      <div className="subtabbar" aria-label="Equipment tables">
        <button type="button" className="active">
          Rooms
        </button>
        <button type="button" disabled>
          Thermal Bridges
        </button>
        <button type="button" disabled>
          ERVs
        </button>
        <button type="button" disabled>
          Pumps
        </button>
        <button type="button" disabled>
          Fans
        </button>
      </div>
      {roomsSlice.source === "draft" ? (
        <p className="draft-banner">Unsaved Rooms draft restored</p>
      ) : null}
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <RoomsTable
        roomsSlice={roomsSlice}
        isEditor={isEditor}
        onEdit={(room) => setRoomModal({ mode: "edit", room })}
      />
      {roomModal?.mode === "edit" && isEditor ? (
        <div className="room-actions">
          <button
            type="button"
            className="danger-button"
            onClick={() => deleteRoom(roomModal.room)}
          >
            Delete room
          </button>
        </div>
      ) : null}
      {roomModal ? (
        <RoomModal
          key={roomModal.mode === "add" ? "add" : roomModal.room.id}
          title={
            roomModal.mode === "add"
              ? "Add room"
              : `Room: ${roomModal.room.number} - ${roomModal.room.name}`
          }
          room={roomModal.mode === "add" ? emptyRoom() : roomModal.room}
          roomsSlice={roomsSlice}
          onCancel={() => setRoomModal(null)}
          onSubmit={saveRoom}
        />
      ) : null}
    </section>
  );
}
