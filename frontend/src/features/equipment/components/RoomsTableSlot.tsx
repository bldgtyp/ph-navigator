// Thin adapter that wires `useSliceTableController`'s outputs into
// the existing <RoomsTable> component. Kept feature-local because the
// columnDefs / catalog wiring inside <RoomsTable> are Rooms-specific
// — only the prop wiring is generic enough to be worth extracting.

import { useRef } from "react";
import { generatedId } from "../../../shared/lib/ids";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import type {
  BuildEmptyRow,
  FieldRegistryEntry,
  LinkedRecordCellOps,
  LinkedRecordTargetTableOption,
  ViewState,
} from "../../../shared/ui/data-table";
import { useRowFocusHighlight } from "../../../shared/ui/data-table";
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
  // Per-fieldKey integration surface for `linked_record` columns. The
  // page owner builds the Map from whichever target-table slice each
  // field points at (see `buildLinkedRecordOps`).
  linkedRecordOps?: ReadonlyMap<string, LinkedRecordCellOps>;
  // Available target tables for the field config modal's "Linked
  // record" target dropdown. Forwarded to <RoomsTable> → <DataTable>
  // → <FieldConfigModal>. Page-level consumer derives this from the
  // document's `TableContract` manifest.
  linkedRecordTargets?: ReadonlyArray<LinkedRecordTargetTableOption>;
  focusRowId?: string | null;
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
    linkedRecordOps,
    linkedRecordTargets,
    focusRowId,
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusDependencyKey = controller.viewLoading
    ? "loading"
    : `ready:${roomsSlice.rooms.length}`;
  useRowFocusHighlight({
    containerRef,
    rowId: focusRowId ?? null,
    dependencyKey: focusDependencyKey,
  });
  if (controller.viewLoading) {
    return (
      <div ref={containerRef}>
        <p className="form-note">Loading table view…</p>
      </div>
    );
  }
  return (
    <div ref={containerRef}>
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
        {...customFieldActionsForController(controller)}
        formulaFieldRegistry={formulaFieldRegistry}
        getFormulaRowValues={getFormulaRowValues}
        rowsComputed={roomsSlice.rows_computed}
        linkedRecordOps={linkedRecordOps}
        linkedRecordTargets={linkedRecordTargets}
      />
    </div>
  );
}
