import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { generatedId } from "../../../shared/lib/ids";
import {
  IncomingLinkPicker,
  incomingIdsForSourceKey,
  incomingLinkSelectionWrites,
  linkedRecordMaxLinksFromFieldDefs,
} from "../../../shared/ui/data-table";
import { SliceTableShell, useSliceTableController } from "../../../shared/ui/data-table/feature";
import { wasLocalDraftTouched } from "../../equipment/lib";
import { useRoomsSliceQuery } from "../../equipment/hooks";
import { emptyRoomsSlice } from "../../equipment/lib/emptyRoomsSlice";
import { isRoomsSource } from "../../equipment/lib/inverseSource";
import { routeForInverseSource } from "../../equipment/lib/inverseRoutes";
import { roomDisplayLabel } from "../../equipment/lib/roomLabels";
import { RoomDialogStack, type RoomModalState } from "../../equipment/components/RoomDialogStack";
import { useRoomDialogController } from "../../equipment/lib/useRoomDialogController";
import type { RoomRow, RoomsSlice } from "../../equipment/types";
import type { ProjectDetail } from "../../projects/types";
import { SpaceTypesTableSlot } from "../components/SpaceTypesTableSlot";
import { buildEmptySpaceTypeRow } from "../lib/buildEmptySpaceTypeRow";
import { spaceTypeColumnStubs, spaceTypesPayloadBuilders } from "../lib/spaceTypesController";
import {
  useReplaceSpaceTypesSliceMutation,
  useSpaceTypesSchemaMutation,
  useSpaceTypesSliceQuery,
} from "../hooks";
import {
  SPACE_TYPE_ID_PREFIX,
  SPACE_TYPES_TABLE_NAME,
  type InverseLinkField,
  type SpaceTypeRow,
  type SpaceTypesSlice,
} from "../types";
import type { LinkedRoomResolver } from "../components/SpaceTypesTable";

export function SpaceTypesPage({ project }: { project: ProjectDetail }) {
  const spaceTypesQuery = useSpaceTypesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const hasRoomInverseLinks =
    spaceTypesQuery.data?.inverse_link_fields.some(isRoomsSource) ?? false;
  const roomsQuery = useRoomsSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
    hasRoomInverseLinks,
  );

  if (spaceTypesQuery.isLoading) {
    return (
      <section className="tab-panel" aria-label="Space-Types">
        <p>Loading Space-Types...</p>
      </section>
    );
  }
  if (spaceTypesQuery.isError || !spaceTypesQuery.data) {
    return (
      <section className="tab-panel" aria-label="Space-Types">
        <p className="form-error" role="alert">
          Could not load Space-Types.
        </p>
      </section>
    );
  }

  return (
    <SpaceTypesPageBody
      project={project}
      spaceTypesSlice={spaceTypesQuery.data}
      roomsSlice={roomsQuery.data ?? null}
      refetch={spaceTypesQuery.refetch}
      refetchRooms={roomsQuery.refetch}
    />
  );
}

function SpaceTypesPageBody({
  project,
  spaceTypesSlice,
  roomsSlice,
  refetch,
  refetchRooms,
}: {
  project: ProjectDetail;
  spaceTypesSlice: SpaceTypesSlice;
  roomsSlice: RoomsSlice | null;
  refetch: () => Promise<unknown>;
  refetchRooms: () => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeVersionId = project.active_version_id;
  const replaceMutation = useReplaceSpaceTypesSliceMutation(project.id, activeVersionId);
  const schemaMutation = useSpaceTypesSchemaMutation(project.id, activeVersionId);
  const isEditor = project.access_mode === "editor";
  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);
  const [roomPendingDelete, setRoomPendingDelete] = useState<RoomRow | null>(null);
  const [inverseLinkPicker, setInverseLinkPicker] = useState<{
    field: InverseLinkField;
    row: SpaceTypeRow;
  } | null>(null);
  const columnsForSanitize = useMemo(
    () => spaceTypeColumnStubs(spaceTypesSlice.field_defs, spaceTypesSlice.inverse_link_fields),
    [spaceTypesSlice.field_defs, spaceTypesSlice.inverse_link_fields],
  );

  const controller = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: SPACE_TYPES_TABLE_NAME,
    slice: spaceTypesSlice,
    fieldDefs: spaceTypesSlice.field_defs,
    singleSelectOptions: spaceTypesSlice.single_select_options,
    columnsForSanitize,
    payloadBuilders: spaceTypesPayloadBuilders,
    conflictMessages: {
      activeRowConflict:
        "This Space-Types draft changed in another tab. Reload the draft before editing.",
      deleteConflict: "Could not delete Space-Type.",
      versionLocked: "This version is locked. Save As to copy it into a new version.",
    },
    buildEmptyRow: buildEmptySpaceTypeRow,
    activeRow: null,
    replaceMutation,
    schemaMutation,
    refetch,
  });
  const activeRoom = roomModal?.mode === "edit" ? roomModal.room : null;
  const roomDialog = useRoomDialogController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    roomsSlice: roomsSlice ?? emptyRoomsSlice(),
    refetch: refetchRooms,
    activeRoom,
    onSaved: () => setRoomModal(null),
    onDeleted: () => {
      setRoomPendingDelete(null);
      setRoomModal(null);
    },
  });

  const resolveLinkedRoom = useMemo<LinkedRoomResolver>(() => {
    const rowsComputed = roomsSlice?.rows_computed ?? {};
    const labelsById = new Map(
      (roomsSlice?.rooms ?? []).map((room) => [
        room.id,
        roomDisplayLabel(room, rowsComputed[room.id]),
      ]),
    );
    return (rowId) => {
      const label = labelsById.get(rowId);
      return label === undefined ? null : { recordId: label };
    };
  }, [roomsSlice]);

  const onInversePillClick = useCallback(
    (field: InverseLinkField, rowId: string) => {
      if (isRoomsSource(field)) {
        const room = roomsSlice?.rooms.find((candidate) => candidate.id === rowId);
        if (room) setRoomModal({ mode: "edit", room });
        return;
      }
      const route = routeForInverseSource(project.id, field, rowId, { openRoom: true });
      if (!route) return;
      const next = new URLSearchParams(searchParams);
      const [pathname, routeSearch] = route.split("?");
      if (routeSearch) {
        for (const [key, value] of new URLSearchParams(routeSearch)) {
          next.set(key, value);
        }
      }
      navigate({
        pathname,
        search: next.toString() ? `?${next.toString()}` : "",
      });
    },
    [navigate, project.id, roomsSlice?.rooms, searchParams],
  );

  const openInverseLinkPicker = useCallback((field: InverseLinkField, row: SpaceTypeRow) => {
    if (!isRoomsSource(field)) return;
    setInverseLinkPicker({ field, row });
  }, []);

  const roomCandidates = useMemo(
    () =>
      (roomsSlice?.rooms ?? []).map((room) => ({
        rowId: room.id,
        recordId: roomDisplayLabel(room, roomsSlice?.rows_computed?.[room.id]),
      })),
    [roomsSlice],
  );

  const linkRoomsToSpaceType = async (spaceType: SpaceTypeRow, roomIds: readonly string[]) => {
    if (!inverseLinkPicker || !roomsSlice || !isRoomsSource(inverseLinkPicker.field)) return;
    const sourceFieldKey = inverseLinkPicker.field.source_field_key;
    const writes = incomingLinkSelectionWrites({
      sourceRows: roomsSlice.rooms,
      sourceFieldKey,
      targetRowId: spaceType.id,
      selectedSourceRowIds: roomIds,
      maxLinks: linkedRecordMaxLinksFromFieldDefs(roomsSlice.field_defs, sourceFieldKey),
    });
    if (writes.length > 0) {
      await roomDialog.controller.onWrite({ kind: "cell", writes });
    }
    setInverseLinkPicker(null);
  };

  const reloadDraft = async () => {
    setRoomModal(null);
    setRoomPendingDelete(null);
    await controller.reloadDraft();
  };

  const reloadRoomDraft = async () => {
    setRoomModal(null);
    setRoomPendingDelete(null);
    await roomDialog.controller.reloadDraft();
  };

  return (
    <SliceTableShell
      ariaLabel="Space-Types"
      className="tab-panel spaces-panel"
      showDraftRestoredBanner={
        spaceTypesSlice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, spaceTypesSlice.draft_etag)
      }
      draftRestoredMessage="Space-Types draft restored"
      isLocked={controller.isLocked}
      lockedMessage="This version is locked. Save As to copy it into a new version."
      editBlocker={controller.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={controller.actionError}
    >
      <SpaceTypesTableSlot
        controller={controller}
        spaceTypesSlice={spaceTypesSlice}
        projectId={project.id}
        activeVersionId={activeVersionId}
        buildEmptyRow={buildEmptySpaceTypeRow}
        footerAction={addSpaceTypeButton(controller.canEdit, () => insertSpaceTypeRow(controller))}
        focusRowId={searchParams.get("focus")}
        resolveLinkedRoom={resolveLinkedRoom}
        onInversePillClick={onInversePillClick}
        onInverseLinkEdit={openInverseLinkPicker}
      />
      <IncomingLinkPicker
        state={
          inverseLinkPicker
            ? {
                row: inverseLinkPicker.row,
                selectedIds: incomingIdsForSourceKey(
                  spaceTypesSlice.inverse_links,
                  inverseLinkPicker.row.id,
                  inverseLinkPicker.field.source_key,
                ),
                candidates: roomCandidates,
                title: `Link ${inverseLinkPicker.field.source_table_display}`,
                isLoading: !roomsSlice,
              }
            : null
        }
        onCancel={() => setInverseLinkPicker(null)}
        onConfirm={linkRoomsToSpaceType}
      />
      {roomsSlice ? (
        <RoomDialogStack
          isEditor={isEditor}
          roomsSlice={roomsSlice}
          roomModal={roomModal}
          roomPendingDelete={roomPendingDelete}
          frozenReason={roomDialog.frozenReason}
          blockerActive={Boolean(roomDialog.controller.editBlocker)}
          deletePending={roomDialog.controller.isReplacePending}
          onCancelModal={() => setRoomModal(null)}
          onSubmitRoom={roomDialog.saveRoom}
          onRequestDelete={(room) => setRoomPendingDelete(room)}
          onCancelDelete={() => setRoomPendingDelete(null)}
          onConfirmDelete={roomDialog.deleteRoom}
          onFrozenReload={() => void reloadRoomDraft()}
        />
      ) : null}
    </SliceTableShell>
  );
}

function addSpaceTypeButton(canEdit: boolean, onAdd: () => void) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label="Add Space-Type"
      title="Add Space-Type"
      onClick={onAdd}
    >
      +
    </button>
  );
}

function insertSpaceTypeRow(controller: { onWrite: SpaceTypesSliceControllerWrite }) {
  void controller.onWrite({
    kind: "rowInsert",
    rows: [
      {
        rowId: generatedId(SPACE_TYPE_ID_PREFIX),
        fieldDefaults: {},
        anchorRowId: null,
      },
    ],
  });
}

type SpaceTypesSliceControllerWrite = (op: {
  kind: "rowInsert";
  rows: { rowId: string; fieldDefaults: Record<string, unknown>; anchorRowId: null }[];
}) => unknown;
