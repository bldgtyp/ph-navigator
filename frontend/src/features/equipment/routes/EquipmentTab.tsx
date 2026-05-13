import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../../shared/lib/errors";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { emptyViewState } from "../../../shared/ui/data-table";
import { projectDownloadUrl, tableDownloadUrl } from "../../project_document/api";
import { projectDocumentQueryKeys } from "../../project_document/hooks";
import type { ProjectDetail } from "../../projects/types";
import { projectQueryKeys } from "../../projects/query-keys";
import { RoomModal } from "../components/RoomModal";
import { RoomsTable } from "../components/RoomsTable";
import { useReplaceRoomsSliceMutation, useRoomsDraftBroadcast, useRoomsSliceQuery } from "../hooks";
import {
  deleteRoomPayload,
  emptyRoom,
  firstRoomFloorOptionId,
  isDraftStaleError,
  isInvalidProjectDocumentError,
  isVersionLockedError,
  nextRoomsPayload,
  remoteSliceChangesActiveRoom,
  replaceRoomOptionsPayload,
  roomsPayloadFromCellWrites,
  validateRoomsPayload,
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
type EditBlocker =
  | { kind: "draft-conflict"; message: string }
  | { kind: "version-locked"; message: string };

const ACTIVE_ROOM_CONFLICT_MESSAGE =
  "Rooms draft changed in another tab. Reload draft before saving this room.";
const DELETE_CONFLICT_MESSAGE =
  "Rooms draft changed in another tab. Reload draft before deleting rooms.";
const VERSION_LOCKED_MESSAGE =
  "This version was locked elsewhere. Local edits are preserved here; use Save As in the header or discard the draft.";

export function EquipmentTab({ project }: { project: ProjectDetail }) {
  const queryClient = useQueryClient();
  const roomsQuery = useRoomsSliceQuery(project.id, project.active_version_id, project.access_mode);
  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);
  const [roomPendingDelete, setRoomPendingDelete] = useState<RoomRow | null>(null);
  const [roomsTableView, setRoomsTableView] = useState(emptyViewState);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editBlocker, setEditBlocker] = useState<EditBlocker | null>(null);
  const isEditor = project.access_mode === "editor";
  const activeVersionId = project.active_version_id;
  const isLocked =
    editBlocker?.kind === "version-locked" || (project.active_version?.locked ?? false);
  const canEdit = isEditor && !isLocked && !editBlocker && Boolean(activeVersionId);
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
        setEditBlocker({ kind: "draft-conflict", message: ACTIVE_ROOM_CONFLICT_MESSAGE });
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

  useEffect(() => {
    setEditBlocker(null);
  }, [activeVersionId]);

  const reloadDraft = async () => {
    setEditBlocker(null);
    setActionError(null);
    setRoomModal(null);
    await roomsQuery.refetch();
  };

  const handleStaleDraftConflict = async (message: string) => {
    setEditBlocker({ kind: "draft-conflict", message });
    await roomsQuery.refetch();
  };

  const handleVersionLockedConflict = async () => {
    setEditBlocker({ kind: "version-locked", message: VERSION_LOCKED_MESSAGE });
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(project.id) }),
    ];
    if (activeVersionId) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.draftSummary(project.id, activeVersionId),
        }),
      );
    }
    await Promise.all(invalidations);
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
  const commitRoomsPayload = async (
    payload: ReturnType<typeof nextRoomsPayload>,
    conflictMessage: string,
    fallbackMessage: string,
  ) => {
    if (!canEdit) return;
    setActionError(null);
    const validationMessage = validateRoomsPayload(payload);
    if (validationMessage) {
      setActionError(validationMessage);
      throw new Error(validationMessage);
    }
    try {
      await replaceRoomsMutation.mutateAsync({ current: roomsSlice, payload });
    } catch (error) {
      if (isDraftStaleError(error)) {
        await handleStaleDraftConflict(conflictMessage);
        throw error;
      }
      if (isVersionLockedError(error)) {
        await handleVersionLockedConflict();
        throw error;
      }
      const message = errorMessage(error, fallbackMessage);
      setActionError(message);
      throw new Error(message);
    }
  };

  const saveRoom = async (room: RoomRow, labels: { floorLevel: string; buildingZone: string }) => {
    await commitRoomsPayload(
      nextRoomsPayload(roomsSlice, room, labels),
      ACTIVE_ROOM_CONFLICT_MESSAGE,
      "Could not save room.",
    );
    setRoomModal(null);
  };

  const deleteRoom = (room: RoomRow) => {
    if (!canEdit) return;
    void commitRoomsPayload(
      deleteRoomPayload(roomsSlice, room.id),
      DELETE_CONFLICT_MESSAGE,
      "Could not delete room.",
    )
      .then(() => {
        setRoomPendingDelete(null);
        setRoomModal(null);
      })
      .catch(() => undefined);
  };

  const handleTableWrite = async (op: WriteOp) => {
    if (!canEdit || (op.kind !== "paste" && op.kind !== "cell")) return;
    await commitRoomsPayload(
      roomsPayloadFromCellWrites(roomsSlice, op.writes, op.kind === "paste" ? op.newOptions : {}),
      ACTIVE_ROOM_CONFLICT_MESSAGE,
      "Could not update rooms table values.",
    );
  };

  const saveOptions = (
    fieldKey: RoomOptionKey,
    options: SingleSelectOption[],
    replacements: Record<string, string | null> = {},
  ) => {
    if (!canEdit) return;
    let payload: ReturnType<typeof replaceRoomOptionsPayload>;
    try {
      payload = replaceRoomOptionsPayload(roomsSlice, fieldKey, options, replacements);
    } catch (error) {
      setActionError(errorMessage(error, "Could not update room options."));
      return;
    }
    void commitRoomsPayload(
      payload,
      ACTIVE_ROOM_CONFLICT_MESSAGE,
      "Could not update room options.",
    ).catch(() => undefined);
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
      {editBlocker ? (
        <div className="draft-banner draft-conflict-banner" role="alert">
          <span>{editBlocker.message}</span>
          {editBlocker.kind === "draft-conflict" ? (
            <button type="button" className="secondary-button" onClick={() => void reloadDraft()}>
              Reload draft
            </button>
          ) : null}
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
      {roomModal && isEditor ? (
        <RoomModal
          key={roomModal.mode === "add" ? "add" : roomModal.room.id}
          title={
            roomModal.mode === "add"
              ? "New room"
              : `Room: ${roomModal.room.number} - ${roomModal.room.name}`
          }
          room={
            roomModal.mode === "add"
              ? emptyRoom(firstRoomFloorOptionId(roomsSlice))
              : roomModal.room
          }
          roomsSlice={roomsSlice}
          onCancel={() => setRoomModal(null)}
          onSubmit={saveRoom}
          frozenReason={editBlocker?.message ?? (isLocked ? VERSION_LOCKED_MESSAGE : null)}
          onFrozenReload={() => void reloadDraft()}
          onDelete={
            roomModal.mode === "edit" ? () => setRoomPendingDelete(roomModal.room) : undefined
          }
          deleteDisabled={Boolean(editBlocker)}
        />
      ) : null}
      {roomPendingDelete ? (
        <ModalDialog
          title={`Delete room ${roomPendingDelete.number}?`}
          titleId="delete-room-title"
          onClose={() => setRoomPendingDelete(null)}
        >
          <p>This removes the room from the active draft.</p>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRoomPendingDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => deleteRoom(roomPendingDelete)}
              disabled={replaceRoomsMutation.isPending}
            >
              Delete room
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </section>
  );
}
