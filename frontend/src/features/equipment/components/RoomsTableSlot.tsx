// Thin adapter that wires `useSliceTableController`'s outputs into
// the existing <RoomsTable> component. Kept feature-local because the
// columnDefs / catalog wiring inside <RoomsTable> are Rooms-specific
// — only the prop wiring is generic enough to be worth extracting.

import { generatedId } from "../../../shared/lib/ids";
import type { SliceTableController } from "../../../shared/ui/data-table/feature";
import type { BuildEmptyRow, FieldRegistryEntry, ViewState } from "../../../shared/ui/data-table";
import { RoomsTable } from "./RoomsTable";
import { ROOM_ID_PREFIX } from "../lib";
import { ROOMS_TABLE_NAME, type RoomRow, type RoomsSlice } from "../types";

export type RoomsTableSlotProps = {
  controller: SliceTableController<RoomsSlice>;
  roomsSlice: RoomsSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<RoomRow>;
  formulaFieldRegistry: FieldRegistryEntry[];
  getFormulaRowValues: (room: RoomRow) => Record<string, unknown>;
  downloadAction: React.ReactNode;
  footerAction: React.ReactNode;
  onEdit: (room: RoomRow) => void;
};

export function RoomsTableSlot(props: RoomsTableSlotProps) {
  const {
    controller,
    roomsSlice,
    projectId,
    activeVersionId,
    buildEmptyRow,
    formulaFieldRegistry,
    getFormulaRowValues,
    downloadAction,
    footerAction,
    onEdit,
  } = props;
  if (controller.viewLoading) {
    return <p className="form-note">Loading table view…</p>;
  }
  return (
    <RoomsTable
      roomsSlice={roomsSlice}
      tableSchema={controller.tableSchema}
      isEditor={controller.canEdit}
      onEdit={onEdit}
      view={controller.view as ViewState}
      onViewChange={controller.onViewChange}
      onResetView={controller.onResetView}
      onWrite={controller.onWrite}
      buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
      generateRowId={controller.canEdit ? () => generatedId(ROOM_ID_PREFIX) : undefined}
      sessionKey={`${projectId}:${activeVersionId ?? "none"}:${ROOMS_TABLE_NAME}`}
      overflowMenuActions={downloadAction}
      footerAction={footerAction}
      onDeleteCustomField={controller.canEdit ? controller.handleDeleteCustomField : undefined}
      onAddCustomField={controller.canEdit ? controller.handleAddCustomField : undefined}
      onDuplicateCustomField={
        controller.canEdit ? controller.handleDuplicateCustomField : undefined
      }
      onEditCustomFieldBundle={
        controller.canEdit ? controller.handleEditCustomFieldBundle : undefined
      }
      formulaFieldRegistry={formulaFieldRegistry}
      getFormulaRowValues={getFormulaRowValues}
      rowsComputed={roomsSlice.rows_computed}
    />
  );
}
