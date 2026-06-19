import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generatedId } from "../../../shared/lib/ids";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import {
  IncomingLinkPicker,
  incomingIdsForSourceKey,
  incomingLinkSelectionWrites,
  linkedRecordMaxLinksFromFieldDefs,
  useRowFocusHighlight,
  type BuildEmptyRow,
  type ViewState,
} from "../../../shared/ui/data-table";
import { useRoomsSliceQuery } from "../hooks";
import { PUMP_ID_PREFIX } from "../lib";
import { emptyRoomsSlice } from "../lib/emptyRoomsSlice";
import { isRoomsSource } from "../lib/inverseSource";
import { routeForInverseSource } from "../lib/inverseRoutes";
import { roomDisplayLabel } from "../lib/roomLabels";
import { useRoomDialogController } from "../lib/useRoomDialogController";
import { PUMPS_TABLE_NAME, type InverseLinkField, type PumpRow, type PumpsSlice } from "../types";
import { PumpsTable } from "./PumpsTable";

export type PumpsTableSlotProps = {
  controller: SliceTableController<PumpsSlice>;
  pumpsSlice: PumpsSlice;
  projectId: string;
  activeVersionId: string | null;
  accessMode: "editor" | "viewer";
  versionLocked: boolean;
  buildEmptyRow: BuildEmptyRow<PumpRow>;
  footerAction: React.ReactNode;
  // PRD Q19 — `?focus=<row_id>` from a Rooms→Pumps pill click. The slot
  // owns the container ref; `useRowFocusHighlight` scrolls + highlights
  // the matching `<tr data-row-id>`.
  focusRowId?: string | null;
};

export function PumpsTableSlot(props: PumpsTableSlotProps) {
  const {
    controller,
    pumpsSlice,
    projectId,
    activeVersionId,
    accessMode,
    versionLocked,
    buildEmptyRow,
    footerAction,
    focusRowId,
  } = props;
  const navigate = useNavigate();
  const hasRoomInverseLinks = pumpsSlice.inverse_link_fields?.some(isRoomsSource) ?? false;
  const roomsQuery = useRoomsSliceQuery(
    projectId,
    activeVersionId,
    accessMode,
    hasRoomInverseLinks,
  );
  const roomsSlice = roomsQuery.data ?? emptyRoomsSlice();
  const [inverseLinkPicker, setInverseLinkPicker] = useState<{
    field: InverseLinkField;
    row: PumpRow;
  } | null>(null);
  const roomDialog = useRoomDialogController({
    projectId,
    activeVersionId,
    accessMode,
    versionLocked,
    roomsSlice,
    refetch: roomsQuery.refetch,
    activeRoom: null,
    onSaved: () => undefined,
    onDeleted: () => undefined,
    viewStateEnabled: false,
  });
  const roomCandidates = useMemo(
    () =>
      roomsSlice.rooms.map((room) => ({
        rowId: room.id,
        recordId: roomDisplayLabel(room, roomsSlice.rows_computed?.[room.id]),
      })),
    [roomsSlice],
  );
  const resolveInverseLinkLabel = useMemo(() => {
    const labelsById = new Map(roomCandidates.map((candidate) => [candidate.rowId, candidate]));
    return (field: InverseLinkField, rowId: string): string | null => {
      if (!isRoomsSource(field)) return null;
      return labelsById.get(rowId)?.recordId ?? null;
    };
  }, [roomCandidates]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // §A5 — `viewLoading` flips false AFTER mount; without a re-trigger
  // the one-shot effect runs once on first paint, can't find the row,
  // and never tries again. Bump `dependencyKey` on the loading edge
  // (and on row-count changes) so the effect re-runs when the table
  // body actually exists in the DOM.
  const focusDependencyKey = controller.viewLoading
    ? "loading"
    : `ready:${pumpsSlice.pumps.length}`;
  useRowFocusHighlight({
    containerRef,
    rowId: focusRowId ?? null,
    dependencyKey: focusDependencyKey,
  });
  if (controller.viewLoading) {
    return (
      <div ref={containerRef}>
        <p className="form-note">Loading table view...</p>
      </div>
    );
  }
  const linkRoomsToPump = async (pump: PumpRow, roomIds: readonly string[]) => {
    if (!inverseLinkPicker || !isRoomsSource(inverseLinkPicker.field)) return;
    const sourceFieldKey = inverseLinkPicker.field.source_field_key;
    const writes = incomingLinkSelectionWrites({
      sourceRows: roomsSlice.rooms,
      sourceFieldKey,
      targetRowId: pump.id,
      selectedSourceRowIds: roomIds,
      maxLinks: linkedRecordMaxLinksFromFieldDefs(roomsSlice.field_defs, sourceFieldKey),
    });
    if (writes.length > 0) {
      await roomDialog.controller.onWrite({ kind: "cell", writes });
    }
    setInverseLinkPicker(null);
  };
  return (
    <div ref={containerRef}>
      <PumpsTable
        pumpsSlice={pumpsSlice}
        tableSchema={controller.tableSchema}
        isEditor={controller.canEdit}
        projectId={projectId}
        view={controller.view as ViewState}
        onViewChange={controller.onViewChange}
        onResetView={controller.onResetView}
        onWrite={controller.onWrite}
        buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
        generateRowId={controller.canEdit ? () => generatedId(PUMP_ID_PREFIX) : undefined}
        sessionKey={`${projectId}:${activeVersionId ?? "none"}:${PUMPS_TABLE_NAME}`}
        footerAction={footerAction}
        {...customFieldActionsForController(controller)}
        resolveInverseLinkLabel={resolveInverseLinkLabel}
        onInversePillClick={(field, rowId) => {
          const route = routeForInverseSource(projectId, field, rowId);
          if (route) navigate(route);
        }}
        onInverseLinkEdit={
          controller.canEdit ? (field, row) => setInverseLinkPicker({ field, row }) : undefined
        }
      />
      <IncomingLinkPicker
        state={
          inverseLinkPicker
            ? {
                row: inverseLinkPicker.row,
                selectedIds: incomingIdsForSourceKey(
                  pumpsSlice.inverse_links,
                  inverseLinkPicker.row.id,
                  inverseLinkPicker.field.source_key,
                ),
                candidates: roomCandidates,
                title: `Link ${inverseLinkPicker.field.source_table_display}`,
                isLoading: roomsQuery.isLoading,
              }
            : null
        }
        onCancel={() => setInverseLinkPicker(null)}
        onConfirm={linkRoomsToPump}
      />
    </div>
  );
}
