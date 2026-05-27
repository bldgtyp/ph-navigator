import "../equipment.css";
import { useMemo, useState } from "react";
import { SliceTableShell, useSliceTableController } from "../../../shared/ui/data-table/feature";
import type { FieldDef } from "../../../shared/ui/data-table";
import type { ProjectDetail } from "../../projects/types";
import { RoomsPageError } from "../components/RoomsPageError";
import { RoomDialogStack, type RoomModalState } from "../components/RoomDialogStack";
import {
  buildAddRoomFooterAction,
  buildRoomsDownloadAction,
} from "../components/RoomsToolbarActions";
import { RoomsTableSlot } from "../components/RoomsTableSlot";
import { useRoomsSliceQuery } from "../hooks";
import { roomsFieldOverlay, roomsTableColumnsForSanitize, wasLocalDraftTouched } from "../lib";
import { makeBuildEmptyRoomRow } from "../lib/buildEmptyRoomRow";
import { makeDeleteRoom, makeSaveRoom } from "../lib/roomMutationCallbacks";
import {
  ROOMS_ACTIVE_ROW_CONFLICT_MESSAGE,
  ROOMS_CONFLICT_MESSAGES,
  ROOMS_DELETE_CONFLICT_MESSAGE,
  ROOMS_VERSION_LOCKED_MESSAGE,
} from "../lib/roomsConflictMessages";
import { roomsPayloadBuilders } from "../lib/roomsController";
import { buildRoomFormulaRowValues, buildRoomsFormulaRegistry } from "../lib/roomsFormulaRegistry";
import { useRoomsSliceWiring } from "../lib/useRoomsSliceWiring";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

export function RoomsPage({ project }: { project: ProjectDetail }) {
  const roomsQuery = useRoomsSliceQuery(project.id, project.active_version_id, project.access_mode);
  if (roomsQuery.isLoading) {
    return (
      <section className="tab-panel" aria-label="Rooms">
        <p>Loading rooms...</p>
      </section>
    );
  }
  if (roomsQuery.isError || !roomsQuery.data) {
    return <RoomsPageError project={project} error={roomsQuery.error} />;
  }
  return (
    <RoomsPageBody project={project} roomsSlice={roomsQuery.data} refetch={roomsQuery.refetch} />
  );
}

// Inner body guarantees a non-null `roomsSlice` so the slice-bound
// hooks don't need to short-circuit on every render.
function RoomsPageBody(props: {
  project: ProjectDetail;
  roomsSlice: RoomsSlice;
  refetch: () => Promise<unknown>;
}) {
  const { project, roomsSlice, refetch } = props;
  const activeVersionId = project.active_version_id;
  const isEditor = project.access_mode === "editor";

  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);
  const [roomPendingDelete, setRoomPendingDelete] = useState<RoomRow | null>(null);

  const fieldOverlay = useMemo(() => roomsFieldOverlay(roomsSlice), [roomsSlice]);
  const previewSchemaFieldDefs = useMemo<FieldDef[]>(
    () =>
      roomsSlice.field_defs.map((fieldDef) => ({
        field_key: fieldDef.field_key,
        field_type: fieldDef.field_type === "number" ? "number" : "text",
        display_name: fieldDef.display_name,
      })),
    [roomsSlice.field_defs],
  );
  const columnsForSanitize = useMemo(
    () => roomsTableColumnsForSanitize(previewSchemaFieldDefs),
    [previewSchemaFieldDefs],
  );
  const buildEmptyRoomRow = useMemo(() => makeBuildEmptyRoomRow(roomsSlice), [roomsSlice]);

  const { replaceMutation, schemaMutation, setNotifyRemoteSlice } = useRoomsSliceWiring({
    projectId: project.id,
    activeVersionId,
    isEditor,
  });

  const activeRow = roomModal?.mode === "edit" ? roomModal.room : null;

  const controller = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: ROOMS_TABLE_NAME,
    slice: roomsSlice,
    fieldDefs: roomsSlice.field_defs,
    fieldOverlay,
    singleSelectOptions: roomsSlice.single_select_options ?? null,
    columnsForSanitize,
    payloadBuilders: roomsPayloadBuilders,
    conflictMessages: ROOMS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyRoomRow,
    activeRow,
    replaceMutation,
    schemaMutation,
    refetch,
  });
  setNotifyRemoteSlice(controller.notifyRemoteSlice);

  const formulaFieldRegistry = useMemo(
    () => buildRoomsFormulaRegistry(controller.tableSchema.fieldDefs),
    [controller.tableSchema.fieldDefs],
  );

  const reloadDraft = async () => {
    setRoomModal(null);
    await controller.reloadDraft();
  };

  const saveRoom = makeSaveRoom({
    controller,
    roomsSlice,
    replaceMutation,
    conflictMessage: ROOMS_ACTIVE_ROW_CONFLICT_MESSAGE,
    onSaved: () => setRoomModal(null),
  });
  const deleteRoom = makeDeleteRoom({
    controller,
    roomsSlice,
    replaceMutation,
    conflictMessage: ROOMS_DELETE_CONFLICT_MESSAGE,
    onDeleted: () => {
      setRoomPendingDelete(null);
      setRoomModal(null);
    },
  });

  return (
    <SliceTableShell
      ariaLabel="Rooms"
      className="tab-panel rooms-panel"
      showDraftRestoredBanner={
        roomsSlice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, roomsSlice.draft_etag)
      }
      draftRestoredMessage="Unsaved Rooms draft restored"
      isLocked={controller.isLocked}
      lockedMessage="This version is locked. Save As to copy it into a new version."
      editBlocker={controller.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={controller.actionError}
    >
      <RoomsTableSlot
        controller={controller}
        roomsSlice={roomsSlice}
        projectId={project.id}
        activeVersionId={activeVersionId}
        buildEmptyRow={buildEmptyRoomRow}
        formulaFieldRegistry={formulaFieldRegistry}
        getFormulaRowValues={buildRoomFormulaRowValues}
        downloadAction={buildRoomsDownloadAction(project.id, activeVersionId)}
        footerAction={buildAddRoomFooterAction(controller.canEdit, () =>
          setRoomModal({ mode: "add" }),
        )}
        onEdit={(room) => setRoomModal({ mode: "edit", room })}
      />
      <RoomDialogStack
        isEditor={isEditor}
        roomsSlice={roomsSlice}
        roomModal={roomModal}
        roomPendingDelete={roomPendingDelete}
        frozenReason={
          controller.editBlocker?.message ??
          (controller.isLocked ? ROOMS_VERSION_LOCKED_MESSAGE : null)
        }
        blockerActive={Boolean(controller.editBlocker)}
        deletePending={controller.isReplacePending}
        onCancelModal={() => setRoomModal(null)}
        onSubmitRoom={saveRoom}
        onRequestDelete={(room) => setRoomPendingDelete(room)}
        onCancelDelete={() => setRoomPendingDelete(null)}
        onConfirmDelete={deleteRoom}
        onFrozenReload={() => void reloadDraft()}
      />
    </SliceTableShell>
  );
}
