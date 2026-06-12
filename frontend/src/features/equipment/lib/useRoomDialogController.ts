import { useEffect, useMemo } from "react";
import { tableFieldDefsToFieldDefs, type TableFieldDef } from "../../../shared/ui/data-table";
import { useSliceTableController } from "../../../shared/ui/data-table/feature";
import { roomsFieldOverlay, roomsTableColumnsForSanitize, roomsTableFieldDefs } from "../lib";
import { makeBuildEmptyRoomRow } from "./buildEmptyRoomRow";
import { makeDeleteRoom, makeSaveRoom } from "./roomMutationCallbacks";
import {
  ROOMS_ACTIVE_ROW_CONFLICT_MESSAGE,
  ROOMS_CONFLICT_MESSAGES,
  ROOMS_DELETE_CONFLICT_MESSAGE,
  ROOMS_VERSION_LOCKED_MESSAGE,
} from "./roomsConflictMessages";
import { roomsPayloadBuilders } from "./roomsController";
import { useRoomsSliceWiring } from "./useRoomsSliceWiring";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

export type UseRoomDialogControllerArgs = {
  projectId: string;
  activeVersionId: string | null;
  accessMode: "editor" | "viewer";
  versionLocked: boolean;
  roomsSlice: RoomsSlice;
  refetch: () => Promise<unknown>;
  activeRoom: RoomRow | null;
  onSaved: () => void;
  onDeleted: () => void;
  viewStateEnabled?: boolean;
};

export function useRoomDialogController(args: UseRoomDialogControllerArgs) {
  const {
    projectId,
    activeVersionId,
    accessMode,
    versionLocked,
    roomsSlice,
    refetch,
    activeRoom,
    onSaved,
    onDeleted,
    viewStateEnabled = true,
  } = args;
  const isEditor = accessMode === "editor";

  const fieldOverlay = useMemo(() => roomsFieldOverlay(roomsSlice), [roomsSlice]);
  const fieldDefs = useMemo<TableFieldDef[]>(
    () =>
      roomsSlice.field_defs ?? [
        ...roomsTableFieldDefs(roomsSlice),
        ...((roomsSlice as RoomsSlice & { custom_fields?: RoomsSlice["field_defs"] })
          .custom_fields ?? []),
      ],
    [roomsSlice],
  );
  const previewSchemaFieldDefs = useMemo(
    () =>
      tableFieldDefsToFieldDefs({
        tableKey: ROOMS_TABLE_NAME,
        fieldDefs,
        fieldOverlay,
        singleSelectOptions: roomsSlice.single_select_options,
      }),
    [fieldDefs, fieldOverlay, roomsSlice.single_select_options],
  );
  const columnsForSanitize = useMemo(
    () => roomsTableColumnsForSanitize(previewSchemaFieldDefs),
    [previewSchemaFieldDefs],
  );
  const buildEmptyRoomRow = useMemo(() => makeBuildEmptyRoomRow(roomsSlice), [roomsSlice]);
  const { replaceMutation, schemaMutation, setNotifyRemoteSlice } = useRoomsSliceWiring({
    projectId,
    activeVersionId,
    isEditor,
  });

  const controller = useSliceTableController({
    projectId,
    activeVersionId,
    accessMode,
    versionLocked,
    tableKey: ROOMS_TABLE_NAME,
    slice: roomsSlice,
    fieldDefs,
    fieldOverlay,
    singleSelectOptions: roomsSlice.single_select_options ?? null,
    columnsForSanitize,
    payloadBuilders: roomsPayloadBuilders,
    conflictMessages: ROOMS_CONFLICT_MESSAGES,
    buildEmptyRow: buildEmptyRoomRow,
    activeRow: activeRoom,
    replaceMutation,
    schemaMutation,
    refetch,
    viewStateEnabled,
  });

  useEffect(() => {
    setNotifyRemoteSlice(controller.notifyRemoteSlice);
  }, [controller.notifyRemoteSlice, setNotifyRemoteSlice]);

  const saveRoom = useMemo(
    () =>
      makeSaveRoom({
        controller,
        roomsSlice,
        replaceMutation,
        conflictMessage: ROOMS_ACTIVE_ROW_CONFLICT_MESSAGE,
        onSaved,
      }),
    [controller, onSaved, replaceMutation, roomsSlice],
  );
  const deleteRoom = useMemo(
    () =>
      makeDeleteRoom({
        controller,
        roomsSlice,
        replaceMutation,
        conflictMessage: ROOMS_DELETE_CONFLICT_MESSAGE,
        onDeleted,
      }),
    [controller, onDeleted, replaceMutation, roomsSlice],
  );
  const frozenReason =
    controller.editBlocker?.message ?? (controller.isLocked ? ROOMS_VERSION_LOCKED_MESSAGE : null);

  return {
    controller,
    buildEmptyRoomRow,
    saveRoom,
    deleteRoom,
    frozenReason,
  };
}
