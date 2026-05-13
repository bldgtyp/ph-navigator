import { useCallback, useState } from "react";
import { errorMessage } from "../../../shared/lib/errors";
import { emptyViewState } from "../../../shared/ui/data-table";
import { projectDownloadUrl, tableDownloadUrl } from "../../project_document/api";
import type { ProjectDetail } from "../../projects/types";
import { RoomModal } from "../components/RoomModal";
import { RoomsTable } from "../components/RoomsTable";
import { useReplaceRoomsSliceMutation, useRoomsDraftBroadcast, useRoomsSliceQuery } from "../hooks";
import {
  deleteRoomPayload,
  emptyRoom,
  isDraftStaleError,
  isInvalidProjectDocumentError,
  nextRoomsPayload,
  remoteSliceChangesActiveRoom,
  replaceRoomOptionsPayload,
  roomsPayloadFromCellWrites,
} from "../lib";
import type { WriteOp } from "../../../shared/ui/data-table";
import {
  ROOMS_TABLE_NAME,
  type RoomOptionKey,
  type RoomRow,
  type RoomsSlice,
  type SingleSelectOption,
} from "../types";

type RoomModalState = { mode: "add" } | { mode: "edit"; room: RoomRow };

const ACTIVE_ROOM_CONFLICT_MESSAGE =
  "Rooms draft changed in another tab. Reload draft before saving this room.";
const DELETE_CONFLICT_MESSAGE =
  "Rooms draft changed in another tab. Reload draft before deleting rooms.";

export function EquipmentTab({ project }: { project: ProjectDetail }) {
  const roomsQuery = useRoomsSliceQuery(project.id, project.active_version_id, project.access_mode);
  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);
  const [roomsTableView, setRoomsTableView] = useState(emptyViewState);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftConflictReason, setDraftConflictReason] = useState<string | null>(null);
  const isEditor = project.access_mode === "editor";
  const isLocked = project.active_version?.locked ?? false;
  const activeVersionId = project.active_version_id;
  const canEdit = isEditor && !isLocked && !draftConflictReason && Boolean(activeVersionId);
  const onRemoteSlice = useCallback(
    (incomingSlice: RoomsSlice) => {
      if (!roomModal) {
        return;
      }
      if (
        roomModal.mode === "edit" &&
        roomsQuery.data &&
        remoteSliceChangesActiveRoom(roomsQuery.data, incomingSlice, roomModal.room)
      ) {
        setDraftConflictReason(ACTIVE_ROOM_CONFLICT_MESSAGE);
      }
    },
    [roomModal, roomsQuery.data],
  );
  const publishRoomsSlice = useRoomsDraftBroadcast(
    project.id,
    activeVersionId,
    isEditor,
    onRemoteSlice,
  );
  const replaceRoomsMutation = useReplaceRoomsSliceMutation(
    project.id,
    activeVersionId,
    publishRoomsSlice,
  );

  const reloadDraft = async () => {
    setDraftConflictReason(null);
    setActionError(null);
    setRoomModal(null);
    await roomsQuery.refetch();
  };

  const handleStaleDraftConflict = async (message: string) => {
    setDraftConflictReason(message);
    await roomsQuery.refetch();
  };

  if (roomsQuery.isLoading) {
    return (
      <section className="tab-panel" aria-labelledby="equipment-title">
        <h2 id="equipment-title">Equipment</h2>
        <p>Loading rooms...</p>
      </section>
    );
  }

  if (roomsQuery.isError || !roomsQuery.data) {
    const invalidDocument = isInvalidProjectDocumentError(roomsQuery.error);
    return (
      <section className="tab-panel" aria-labelledby="equipment-title">
        <h2 id="equipment-title">Equipment</h2>
        <p role="alert">{errorMessage(roomsQuery.error, "Could not load rooms.")}</p>
        {invalidDocument && activeVersionId ? (
          <p className="form-note">
            Editing is disabled for this version.{" "}
            <a href={projectDownloadUrl(project.id, activeVersionId)}>Download raw project JSON</a>
          </p>
        ) : null}
      </section>
    );
  }

  const roomsSlice = roomsQuery.data;
  const saveRoom = async (room: RoomRow, labels: { floorLevel: string; buildingZone: string }) => {
    if (!canEdit) return;
    setActionError(null);
    const payload = nextRoomsPayload(roomsSlice, room, labels);
    try {
      await replaceRoomsMutation.mutateAsync({ current: roomsSlice, payload });
      setRoomModal(null);
    } catch (error) {
      if (isDraftStaleError(error)) {
        await handleStaleDraftConflict(ACTIVE_ROOM_CONFLICT_MESSAGE);
        throw error;
      }
      throw error;
    }
  };

  const deleteRoom = (room: RoomRow) => {
    if (!canEdit) return;
    if (!window.confirm(`Delete room ${room.number}?`)) return;
    setActionError(null);
    replaceRoomsMutation.mutate(
      { current: roomsSlice, payload: deleteRoomPayload(roomsSlice, room.id) },
      {
        onError: async (error) => {
          if (isDraftStaleError(error)) {
            await handleStaleDraftConflict(DELETE_CONFLICT_MESSAGE);
            return;
          }
          setActionError(errorMessage(error, "Could not delete room."));
        },
      },
    );
  };

  const handleTableWrite = (op: WriteOp) => {
    if (!canEdit || op.kind !== "paste") return;
    setActionError(null);
    replaceRoomsMutation.mutate(
      {
        current: roomsSlice,
        payload: roomsPayloadFromCellWrites(roomsSlice, op.writes, op.newOptions),
      },
      {
        onError: async (error) => {
          if (isDraftStaleError(error)) {
            await handleStaleDraftConflict(ACTIVE_ROOM_CONFLICT_MESSAGE);
            return;
          }
          setActionError(errorMessage(error, "Could not paste rooms table values."));
        },
      },
    );
  };

  const saveOptions = (
    fieldKey: RoomOptionKey,
    options: SingleSelectOption[],
    replacements: Record<string, string | null> = {},
  ) => {
    if (!canEdit) return;
    setActionError(null);
    replaceRoomsMutation.mutate(
      {
        current: roomsSlice,
        payload: replaceRoomOptionsPayload(roomsSlice, fieldKey, options, replacements),
      },
      {
        onError: async (error) => {
          if (isDraftStaleError(error)) {
            await handleStaleDraftConflict(ACTIVE_ROOM_CONFLICT_MESSAGE);
            return;
          }
          setActionError(errorMessage(error, "Could not update room options."));
        },
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
        <div className="table-actions">
          {activeVersionId ? (
            <a
              className="secondary-button download-link"
              href={tableDownloadUrl(project.id, activeVersionId, ROOMS_TABLE_NAME)}
            >
              Rooms JSON
            </a>
          ) : null}
          {canEdit ? (
            <button type="button" onClick={() => setRoomModal({ mode: "add" })}>
              Add room
            </button>
          ) : null}
        </div>
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
      {isLocked ? (
        <p className="draft-banner">
          This version is locked. Save As to copy it into a new version.
        </p>
      ) : null}
      {draftConflictReason ? (
        <div className="draft-banner draft-conflict-banner" role="alert">
          <span>{draftConflictReason}</span>
          <button type="button" className="secondary-button" onClick={() => void reloadDraft()}>
            Reload draft
          </button>
        </div>
      ) : null}
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      <RoomsTable
        roomsSlice={roomsSlice}
        isEditor={canEdit}
        onEdit={(room) => setRoomModal({ mode: "edit", room })}
        view={roomsTableView}
        onViewChange={setRoomsTableView}
        onWrite={handleTableWrite}
        onSaveOptions={saveOptions}
      />
      {roomModal?.mode === "edit" && isEditor && !isLocked ? (
        <div className="room-actions">
          <button
            type="button"
            className="danger-button"
            onClick={() => deleteRoom(roomModal.room)}
            disabled={Boolean(draftConflictReason)}
          >
            Delete room
          </button>
        </div>
      ) : null}
      {roomModal && isEditor && !isLocked ? (
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
          frozenReason={draftConflictReason}
          onFrozenReload={() => void reloadDraft()}
        />
      ) : null}
    </section>
  );
}
