import { useMemo, useState } from "react";
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
  type BuildEmptyRow,
  type CellWrite,
  type ViewState,
} from "../../../shared/ui/data-table";
import {
  heatPumpIndoorEquipSliceFeature,
  heatPumpIndoorUnitsSliceFeature,
  heatPumpOutdoorUnitsSliceFeature,
} from "../heat-pumps/api";
import { heatPumpIndoorUnitsPayloadBuilders } from "../heat-pumps/lib";
import { incomingIndoorUnitIds } from "../heat-pumps/link-fields";
import { IndoorUnitRowModal } from "../heat-pumps/components/IndoorUnitRowModal";
import type { HeatPumpIndoorUnitRow } from "../heat-pumps/types";
import { useRoomsSliceQuery } from "../hooks";
import { VENTILATOR_ID_PREFIX } from "../lib";
import { emptyRoomsSlice } from "../lib/emptyRoomsSlice";
import { isRoomsSource } from "../lib/inverseSource";
import { routeForInverseSource } from "../lib/inverseRoutes";
import { roomDisplayLabel } from "../lib/roomLabels";
import { useRoomDialogController } from "../lib/useRoomDialogController";
import { ventilatorCellWritesFromModalRow } from "../lib/ventilatorModalPayload";
import {
  VENTILATORS_TABLE_NAME,
  type InverseLinkField,
  type VentilatorRow,
  type VentilatorsSlice,
} from "../types";
import { VentilatorsTable } from "./VentilatorsTable";
import { VentilatorRowModal } from "./VentilatorRowModal";

export type VentilatorsTableSlotProps = {
  controller: SliceTableController<VentilatorsSlice>;
  ventilatorsSlice: VentilatorsSlice;
  projectId: string;
  activeVersionId: string | null;
  accessMode: "editor" | "viewer";
  versionLocked: boolean;
  buildEmptyRow: BuildEmptyRow<VentilatorRow>;
  footerAction: React.ReactNode;
  focusRowId?: string | null;
};

export function VentilatorsTableSlot(props: VentilatorsTableSlotProps) {
  const {
    controller,
    ventilatorsSlice,
    projectId,
    activeVersionId,
    accessMode,
    versionLocked,
    buildEmptyRow,
    footerAction,
    focusRowId,
  } = props;
  const navigate = useNavigate();
  const [activeVentilator, setActiveVentilator] = useState<VentilatorRow | null>(null);
  const [activeIndoorUnit, setActiveIndoorUnit] = useState<HeatPumpIndoorUnitRow | null>(null);
  const [linkPickerRow, setLinkPickerRow] = useState<VentilatorRow | null>(null);
  const [inverseLinkPicker, setInverseLinkPicker] = useState<{
    field: InverseLinkField;
    row: VentilatorRow;
  } | null>(null);
  // The ventilator side edits HP indoor units through the generic indoor-units
  // slice feature: read the leaf (+ the sibling equip / outdoor-unit leaves the
  // modal references for labels) and replace rows through the shared write path.
  const indoorUnitsQuery = heatPumpIndoorUnitsSliceFeature.useSliceQuery(
    projectId,
    activeVersionId,
    accessMode,
  );
  const indoorEquipQuery = heatPumpIndoorEquipSliceFeature.useSliceQuery(
    projectId,
    activeVersionId,
    accessMode,
  );
  const outdoorUnitsQuery = heatPumpOutdoorUnitsSliceFeature.useSliceQuery(
    projectId,
    activeVersionId,
    accessMode,
  );
  const indoorUnitsReplace = heatPumpIndoorUnitsSliceFeature.useReplaceSliceMutation(
    projectId,
    activeVersionId,
  );
  const hasRoomInverseLinks = ventilatorsSlice.inverse_link_fields?.some(isRoomsSource) ?? false;
  const roomsQuery = useRoomsSliceQuery(
    projectId,
    activeVersionId,
    accessMode,
    hasRoomInverseLinks,
  );
  const roomsSlice = roomsQuery.data ?? emptyRoomsSlice();
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
  if (controller.viewLoading) {
    return <p className="form-note">Loading table view...</p>;
  }
  const indoorUnitsSlice = indoorUnitsQuery.data ?? null;
  const indoorUnits = indoorUnitsSlice?.indoor_units ?? [];
  const incomingIndoorUnitIdsByVentilatorId = groupIndoorUnitIdsByVentilator(indoorUnits);
  const readOnly = !controller.canEdit;
  // The indoor-unit modal reads its own option lists plus the sibling equip /
  // outdoor-unit lists referenced for display labels.
  const heatPumpOptions = {
    ...indoorUnitsSlice?.single_select_options,
    ...indoorEquipQuery.data?.single_select_options,
    ...outdoorUnitsQuery.data?.single_select_options,
  };
  // One atomic replace for any number of indoor-unit row edits — the leaf
  // replace endpoint rewrites the whole rows list, so batching avoids the stale
  // etag a per-row loop would hit on its second write.
  const replaceIndoorUnitRows = async (writes: CellWrite[]) => {
    if (!indoorUnitsSlice || writes.length === 0) return;
    await controller.runCoordinatedWrite(
      {
        label: "heat_pump_indoor_units:ventilatorModal",
        run: async () => {
          const refetched = indoorUnitsQuery.isStale ? await indoorUnitsQuery.refetch() : null;
          const current = refetched?.data ?? indoorUnitsSlice;
          const payload = heatPumpIndoorUnitsPayloadBuilders.fromCellWrites(
            current,
            writes,
            {},
            {},
          );
          return indoorUnitsReplace.mutateAsync({ current, payload });
        },
      },
      "The draft changed while the indoor unit was open.",
      "Could not update heat-pump indoor units.",
    );
  };
  const saveVentilator = async (row: VentilatorRow) => {
    await controller.onWrite({
      kind: "cell",
      writes: ventilatorCellWritesFromModalRow(row),
    });
    setActiveVentilator(null);
  };
  const saveIndoorUnit = async (row: HeatPumpIndoorUnitRow) => {
    await replaceIndoorUnitRows(cellWritesForIndoorUnit(row));
    setActiveIndoorUnit(null);
  };
  const linkIndoorUnits = async (ventilator: VentilatorRow, unitIds: readonly string[]) => {
    const selected = new Set(unitIds);
    const writes: CellWrite[] = indoorUnits
      .filter((unit) => selected.has(unit.id) && unit.linked_erv_unit_id !== ventilator.id)
      .map((unit) => ({ rowId: unit.id, fieldKey: "linked_erv_unit_id", value: ventilator.id }));
    await replaceIndoorUnitRows(writes);
    setLinkPickerRow(null);
  };
  const linkRoomsToVentilator = async (ventilator: VentilatorRow, roomIds: readonly string[]) => {
    if (!inverseLinkPicker || !isRoomsSource(inverseLinkPicker.field)) return;
    const sourceFieldKey = inverseLinkPicker.field.source_field_key;
    const writes = incomingLinkSelectionWrites({
      sourceRows: roomsSlice.rooms,
      sourceFieldKey,
      targetRowId: ventilator.id,
      selectedSourceRowIds: roomIds,
      maxLinks: linkedRecordMaxLinksFromFieldDefs(roomsSlice.field_defs, sourceFieldKey),
    });
    if (writes.length > 0) {
      await roomDialog.controller.onWrite({ kind: "cell", writes });
    }
    setInverseLinkPicker(null);
  };
  return (
    <>
      <VentilatorsTable
        ventilatorsSlice={ventilatorsSlice}
        tableSchema={controller.tableSchema}
        isEditor={controller.canEdit}
        projectId={projectId}
        view={controller.view as ViewState}
        onViewChange={controller.onViewChange}
        onResetView={controller.onResetView}
        onWrite={controller.onWrite}
        buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
        generateRowId={controller.canEdit ? () => generatedId(VENTILATOR_ID_PREFIX) : undefined}
        sessionKey={`${projectId}:${activeVersionId ?? "none"}:${VENTILATORS_TABLE_NAME}`}
        footerAction={footerAction}
        focusRowId={focusRowId}
        heatPumpIndoorUnits={indoorUnits}
        onEdit={controller.canEdit ? setActiveVentilator : undefined}
        onIncomingIndoorUnitOpen={(rowId) => {
          const row = indoorUnits.find((unit) => unit.id === rowId) ?? null;
          if (row) setActiveIndoorUnit(row);
        }}
        onIncomingIndoorUnitsLinkEdit={controller.canEdit ? setLinkPickerRow : undefined}
        resolveInverseLinkLabel={resolveInverseLinkLabel}
        onInversePillClick={(field, rowId) => {
          const route = routeForInverseSource(projectId, field, rowId);
          if (route) navigate(route);
        }}
        onInverseLinkEdit={
          controller.canEdit ? (field, row) => setInverseLinkPicker({ field, row }) : undefined
        }
        {...customFieldActionsForController(controller)}
      />
      {activeVentilator ? (
        <VentilatorRowModal
          row={activeVentilator}
          options={ventilatorsSlice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setActiveVentilator(null)}
          onSubmit={saveVentilator}
        />
      ) : null}
      {activeIndoorUnit && indoorUnitsSlice ? (
        <IndoorUnitRowModal
          mode="edit"
          row={activeIndoorUnit}
          indoorEquip={indoorEquipQuery.data?.indoor_equip ?? []}
          outdoorUnits={outdoorUnitsQuery.data?.outdoor_units ?? []}
          ventilators={ventilatorsSlice.ventilators}
          existingUnits={indoorUnits}
          options={heatPumpOptions}
          readOnly={readOnly}
          onCancel={() => setActiveIndoorUnit(null)}
          onSubmit={saveIndoorUnit}
        />
      ) : null}
      <IncomingLinkPicker
        state={
          linkPickerRow
            ? {
                row: linkPickerRow,
                selectedIds: incomingIndoorUnitIds(
                  incomingIndoorUnitIdsByVentilatorId,
                  linkPickerRow.id,
                ),
                candidates: indoorUnits.map((unit) => ({
                  rowId: unit.id,
                  recordId: unit.tag || unit.id,
                })),
                title: "Link HP indoor units",
              }
            : null
        }
        onCancel={() => setLinkPickerRow(null)}
        onConfirm={linkIndoorUnits}
      />
      <IncomingLinkPicker
        state={
          inverseLinkPicker
            ? {
                row: inverseLinkPicker.row,
                selectedIds: incomingIdsForSourceKey(
                  ventilatorsSlice.inverse_links,
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
        onConfirm={linkRoomsToVentilator}
      />
    </>
  );
}

// Mirror `replaceHeatPumpRow`: a full-row replace expressed as one cell write
// per field (the leaf replace endpoint rebuilds the row from these).
function cellWritesForIndoorUnit(row: HeatPumpIndoorUnitRow): CellWrite[] {
  return Object.entries(row)
    .filter(([fieldKey]) => fieldKey !== "id")
    .map(([fieldKey, value]) => ({ rowId: row.id, fieldKey, value }));
}

function groupIndoorUnitIdsByVentilator(
  indoorUnits: readonly HeatPumpIndoorUnitRow[],
): ReadonlyMap<string, readonly string[]> {
  const index = new Map<string, string[]>();
  for (const unit of indoorUnits) {
    if (!unit.linked_erv_unit_id) continue;
    const ids = index.get(unit.linked_erv_unit_id);
    if (ids) {
      ids.push(unit.id);
    } else {
      index.set(unit.linked_erv_unit_id, [unit.id]);
    }
  }
  return index;
}
