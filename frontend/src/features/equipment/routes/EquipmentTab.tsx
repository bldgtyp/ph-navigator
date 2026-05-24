import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../../shared/lib/errors";
import { generatedId } from "../../../shared/lib/ids";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import { emptyViewState } from "../../../shared/ui/data-table";
import { useProjectTableViewState } from "../../table_views/useProjectTableViewState";
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
  isRoomOptionKey,
  isVersionLockedError,
  wasLocalDraftTouched,
  nextFreeRoomNumber,
  nextRoomsPayload,
  remoteSliceChangesActiveRoom,
  replaceRoomOptionsPayload,
  roomsPayloadFromCellWrites,
  roomsPayloadFromRowDelete,
  roomsPayloadFromRowInsert,
  roomsTableColumnsForSanitize,
  roomsTableFieldDefs,
  validateRoomsPayload,
} from "../lib";
import type { BuildEmptyRow, WriteOp } from "../../../shared/ui/data-table";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  ROOMS_TABLE_NAME,
  type RoomOptionKey,
  type RoomRow,
  type RoomsSlice,
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [editBlocker, setEditBlocker] = useState<EditBlocker | null>(null);
  const isEditor = project.access_mode === "editor";
  const activeVersionId = project.active_version_id;
  const roomsViewDefaults = useMemo(() => emptyViewState(), []);
  const roomsFieldDefsForSanitize = useMemo(
    () => (roomsQuery.data ? roomsTableFieldDefs(roomsQuery.data) : []),
    [roomsQuery.data],
  );
  const roomsColumnsForSanitize = useMemo(
    () => roomsTableColumnsForSanitize(roomsFieldDefsForSanitize),
    [roomsFieldDefsForSanitize],
  );
  const {
    view: roomsTableView,
    onViewChange: handleRoomsViewChange,
    isLoading: roomsViewLoading,
    reset: resetRoomsView,
  } = useProjectTableViewState({
    projectId: project.id,
    tableKey: ROOMS_TABLE_NAME,
    defaults: roomsViewDefaults,
    enabled: isEditor,
    columns: roomsColumnsForSanitize,
    fieldDefs: roomsFieldDefsForSanitize,
  });
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
      <section className="tab-panel" aria-label="Equipment">
        <p>Loading rooms...</p>
      </section>
    );
  }

  if (roomsQuery.isError || !roomsQuery.data) {
    const invalidDocument = isInvalidProjectDocumentError(roomsQuery.error);
    return (
      <section className="tab-panel" aria-label="Equipment">
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

  const buildEmptyRoomRow: BuildEmptyRow<RoomRow> = ({ rowId, fieldDefaults, anchorRow }) => {
    if (anchorRow) {
      return {
        ...anchorRow,
        id: rowId,
        number: nextFreeRoomNumber(roomsSlice.rooms, anchorRow.number),
      };
    }
    // No-anchor fallback (currently unreachable via Shift+Enter
    // because the empty-state branch short-circuits the grid). Pulls
    // values from FieldDef.default through the library's
    // buildEmptyRowDefaults output.
    return {
      id: rowId,
      number: nextFreeRoomNumber(roomsSlice.rooms, String(fieldDefaults.number ?? "")),
      name: String(fieldDefaults.name ?? "Untitled"),
      floor_level: ((fieldDefaults[ROOM_FLOOR_LEVEL_KEY] as string | null | undefined) ??
        firstRoomFloorOptionId(roomsSlice)) as string | null,
      building_zone: (fieldDefaults[ROOM_BUILDING_ZONE_KEY] as string | null | undefined) ?? null,
      num_people: Number(fieldDefaults.num_people ?? 0),
      num_bedrooms: Number(fieldDefaults.num_bedrooms ?? 0),
      icfa_factor: Number(fieldDefaults.icfa_factor ?? 1),
      erv_unit_ids: [],
      catalog_origin: null,
      notes: null,
    };
  };

  const handleTableWrite = async (op: WriteOp) => {
    if (!canEdit) return;
    if (op.kind === "cell" || op.kind === "paste" || op.kind === "fill") {
      // Phase 7: `fill` shares the CellWrite[] payload shape with
      // `cell` / `paste` but carries no option list delta (the source
      // values are already in the table — fill never creates options).
      const newOptions =
        op.kind === "paste" ? op.newOptions : op.kind === "cell" ? (op.newOptions ?? {}) : {};
      const removedOptions = op.kind === "fill" ? {} : (op.removedOptions ?? {});
      await commitRoomsPayload(
        roomsPayloadFromCellWrites(roomsSlice, op.writes, newOptions, removedOptions),
        ACTIVE_ROOM_CONFLICT_MESSAGE,
        "Could not update rooms table values.",
      );
      return;
    }
    if (op.kind === "rowInsert") {
      await commitRoomsPayload(
        roomsPayloadFromRowInsert(roomsSlice, op.rows, buildEmptyRoomRow),
        ACTIVE_ROOM_CONFLICT_MESSAGE,
        "Could not insert room.",
      );
      return;
    }
    if (op.kind === "rowDelete") {
      await commitRoomsPayload(
        roomsPayloadFromRowDelete(roomsSlice, op.rows),
        ACTIVE_ROOM_CONFLICT_MESSAGE,
        "Could not delete rooms.",
      );
      return;
    }
    if (op.kind === "fieldDefMutation") {
      const optionKey = op.after.field_key;
      if (!isRoomOptionKey(optionKey)) return;
      // replaceRoomOptionsPayload takes a per-option-id replacement
      // map; the op's cellWrites carry per-row target values. Collapse
      // by reading each row's prior option id from the live slice.
      const replacements = collapseRoomCellWritesToReplacements(
        roomsSlice,
        optionKey,
        op.cellWrites,
      );
      let payload: ReturnType<typeof replaceRoomOptionsPayload>;
      try {
        payload = replaceRoomOptionsPayload(
          roomsSlice,
          optionKey,
          op.after.options ?? [],
          replacements,
        );
      } catch (error) {
        const message = errorMessage(error, "Could not update room options.");
        setActionError(message);
        throw new Error(message);
      }
      await commitRoomsPayload(
        payload,
        ACTIVE_ROOM_CONFLICT_MESSAGE,
        "Could not update room options.",
      );
      return;
    }
  };

  const roomsDownloadAction = activeVersionId ? (
    <a
      className="data-table-overflow-menu-item"
      href={tableDownloadUrl(project.id, activeVersionId, ROOMS_TABLE_NAME)}
    >
      Rooms JSON
    </a>
  ) : null;
  const addRoomAction = canEdit ? (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label="Add New Room"
      title="Add New Room"
      onClick={() => setRoomModal({ mode: "add" })}
    >
      +
    </button>
  ) : null;

  return (
    <section className="tab-panel equipment-panel" aria-label="Equipment">
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
      {roomsSlice.source === "draft" &&
      activeVersionId &&
      !wasLocalDraftTouched(project.id, activeVersionId, roomsSlice.draft_etag) ? (
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
      {roomsViewLoading ? (
        <p className="form-note">Loading table view…</p>
      ) : (
        <RoomsTable
          roomsSlice={roomsSlice}
          isEditor={canEdit}
          onEdit={(room) => setRoomModal({ mode: "edit", room })}
          view={roomsTableView}
          onViewChange={handleRoomsViewChange}
          onResetView={resetRoomsView}
          onWrite={handleTableWrite}
          buildEmptyRow={canEdit ? buildEmptyRoomRow : undefined}
          generateRowId={canEdit ? () => generatedId("rm") : undefined}
          sessionKey={`${project.id}:${activeVersionId ?? "none"}:${ROOMS_TABLE_NAME}`}
          overflowMenuActions={roomsDownloadAction}
          footerAction={addRoomAction}
        />
      )}
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

function collapseRoomCellWritesToReplacements(
  slice: RoomsSlice,
  key: RoomOptionKey,
  cellWrites: ReadonlyArray<{ rowId: string; fieldKey: string; value: unknown }> | undefined,
): Record<string, string | null> {
  if (!cellWrites?.length) return {};
  const roomField = key === ROOM_FLOOR_LEVEL_KEY ? "floor_level" : "building_zone";
  const replacements: Record<string, string | null> = {};
  for (const write of cellWrites) {
    if (write.fieldKey !== key) continue;
    const room = slice.rooms.find((candidate) => candidate.id === write.rowId);
    const previousOptionId = room?.[roomField] ?? null;
    if (previousOptionId) {
      replacements[previousOptionId] = typeof write.value === "string" ? write.value : null;
    }
  }
  return replacements;
}
