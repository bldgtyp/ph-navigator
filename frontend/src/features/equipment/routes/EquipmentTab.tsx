import "../equipment.css";
import { useMemo, useState } from "react";
import { SliceTableShell, useSliceTableController } from "../../../shared/ui/data-table/feature";
import type { ProjectDetail } from "../../projects/types";
import { EquipmentSubTabBar } from "../components/EquipmentSubTabBar";
import { EquipmentTabError } from "../components/EquipmentTabError";
import { RoomDialogStack, type RoomModalState } from "../components/RoomDialogStack";
import {
  buildAddRoomFooterAction,
  buildRoomsDownloadAction,
} from "../components/RoomsToolbarActions";
import { RoomsTableSlot } from "../components/RoomsTableSlot";
import { useRoomsSliceQuery } from "../hooks";
import {
  ROOMS_SCHEMA_CORE_FIELD_KEYS,
  roomsTableColumnsForSanitize,
  roomsTableFieldDefs,
  wasLocalDraftTouched,
} from "../lib";
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

export function EquipmentTab({ project }: { project: ProjectDetail }) {
  const roomsQuery = useRoomsSliceQuery(project.id, project.active_version_id, project.access_mode);
  if (roomsQuery.isLoading) {
    return (
      <section className="tab-panel" aria-label="Equipment">
        <p>Loading rooms...</p>
      </section>
    );
  }
  if (roomsQuery.isError || !roomsQuery.data) {
    return <EquipmentTabError project={project} error={roomsQuery.error} />;
  }
  return (
    <EquipmentTabBody project={project} roomsSlice={roomsQuery.data} refetch={roomsQuery.refetch} />
  );
}

// Inner body guarantees a non-null `roomsSlice` so the slice-bound
// hooks (`useReplaceRoomsSliceMutation`, `useRoomsSchemaMutation`,
// `useSliceTableController`) don't need to short-circuit on every render.
function EquipmentTabBody(props: {
  project: ProjectDetail;
  roomsSlice: RoomsSlice;
  refetch: () => Promise<unknown>;
}) {
  const { project, roomsSlice, refetch } = props;
  const activeVersionId = project.active_version_id;
  const isEditor = project.access_mode === "editor";

  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);
  const [roomPendingDelete, setRoomPendingDelete] = useState<RoomRow | null>(null);

  const coreFieldDefs = useMemo(() => roomsTableFieldDefs(roomsSlice), [roomsSlice]);
  const columnsForSanitize = useMemo(
    () => roomsTableColumnsForSanitize(coreFieldDefs),
    [coreFieldDefs],
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
    coreFieldDefs,
    fingerprintCoreFieldKeys: ROOMS_SCHEMA_CORE_FIELD_KEYS,
    customFields: roomsSlice.custom_fields,
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
      ariaLabel="Equipment"
      className="tab-panel equipment-panel"
      subTabBar={<EquipmentSubTabBar />}
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
