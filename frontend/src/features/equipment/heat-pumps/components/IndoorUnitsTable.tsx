import { useCallback, useMemo, useState } from "react";
import { ApiRequestError } from "../../../../shared/api/client";
import { errorMessage } from "../../../../shared/lib/errors";
import {
  buildLinkedRecordOps,
  DataTable,
  fieldDefsWithRenderOverrides,
  type LinkedRecordCellOps,
} from "../../../../shared/ui/data-table";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../../shared/ui/data-table/feature";
import { useAssetUrls } from "../../../assets/hooks";
import { uniqueAttachmentAssetIds } from "../../../assets/lib";
import { roomsSliceFeature, ventilatorsSliceFeature } from "../../api";
import { LinkedRoomDialogHost } from "../../components/LinkedRoomDialogHost";
import type { RoomRow, VentilatorRow } from "../../types";
import {
  buildEmptyIndoorEquipRow,
  buildEmptyIndoorUnitRow,
  deleteHeatPumpRow,
  indoorEquipLabel,
  insertHeatPumpRow,
  makeHeatPumpOptionCreator,
  outdoorUnitLabel,
  replaceHeatPumpRow,
  roomLabel,
  sortedIndoorUnits,
  uniqueTagForAdd,
  ventilatorLabel,
} from "../lib";
import { HEAT_PUMP_LINK_TARGETS } from "../link-fields";
import { indoorUnitColumnDefs, indoorUnitFieldDefs } from "../indoor-unit-columns";
import {
  HEAT_PUMP_OPTION_KEYS,
  type CascadeReference,
  type HeatPumpIndoorEquipSlice,
  type HeatPumpIndoorEquipRow,
  type HeatPumpIndoorUnitsSlice,
  type HeatPumpIndoorUnitRow,
  type HeatPumpOutdoorUnitsSlice,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "../types";
import { IndoorEquipRowModal } from "./IndoorEquipRowModal";
import { IndoorUnitRowModal } from "./IndoorUnitRowModal";
import { LinkedVentilatorModalHost } from "./LinkedVentilatorModalHost";
import { OutdoorUnitRowModal } from "./OutdoorUnitRowModal";
import { BlockedDeleteDialog } from "./CascadePreviewDialog";
import { heatPumpColumnsWithCustomFields } from "./heatPumpCustomColumns";

type ModalState =
  | { kind: "unit"; mode: "add" | "edit"; row: HeatPumpIndoorUnitRow }
  | { kind: "indoor-equip"; row: HeatPumpIndoorEquipRow }
  | { kind: "outdoor-unit"; row: HeatPumpOutdoorUnitRow }
  | { kind: "ventilator"; row: VentilatorRow }
  | { kind: "equip-create"; row: HeatPumpIndoorEquipRow; selectForUnitId: string }
  | null;

export function IndoorUnitsTable({
  projectId,
  slice,
  leafSlice,
  controller,
  indoorEquipController,
  outdoorUnitsController,
  focusRowId,
  versionLocked,
}: {
  projectId: string;
  slice: HeatPumpsSlice;
  leafSlice: HeatPumpIndoorUnitsSlice;
  controller: SliceTableController<HeatPumpIndoorUnitsSlice>;
  indoorEquipController: SliceTableController<HeatPumpIndoorEquipSlice>;
  outdoorUnitsController: SliceTableController<HeatPumpOutdoorUnitsSlice>;
  focusRowId?: string | null;
  isEditor?: boolean;
  versionLocked: boolean;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const [blockedDialog, setBlockedDialog] = useState<{
    message: string;
    affected: CascadeReference[];
  } | null>(null);
  const [linkedRoomId, setLinkedRoomId] = useState<string | null>(null);
  const accessMode = controller.canEdit ? "editor" : "viewer";
  const ventilatorsQuery = ventilatorsSliceFeature.useSliceQuery(
    projectId,
    slice.version_id,
    accessMode,
  );
  const roomsQuery = roomsSliceFeature.useSliceQuery(projectId, slice.version_id, accessMode);
  const ventilators: VentilatorRow[] = useMemo(
    () => ventilatorsQuery.data?.ventilators ?? [],
    [ventilatorsQuery.data?.ventilators],
  );
  const rooms: RoomRow[] = useMemo(() => roomsQuery.data?.rooms ?? [], [roomsQuery.data?.rooms]);
  const rows = useMemo(() => sortedIndoorUnits(slice.indoor_units), [slice.indoor_units]);
  const assetIds = useMemo(
    () =>
      uniqueAttachmentAssetIds(
        rows,
        (row) => row.datasheet_asset_ids,
        (row) => row.photo_asset_ids,
      ),
    [rows],
  );
  const assetUrls = useAssetUrls(projectId, assetIds);
  const assetUrlById = useMemo(
    () => new Map((assetUrls.data ?? []).map((item) => [item.asset_id, item])),
    [assetUrls.data],
  );
  const readOnly = !controller.canEdit;
  const noEquip = slice.indoor_equip.length === 0;
  const fieldDefs = useMemo(
    () =>
      fieldDefsWithRenderOverrides(
        controller.tableSchema.fieldDefs,
        indoorUnitFieldDefs(slice.single_select_options),
      ),
    [controller.tableSchema.fieldDefs, slice.single_select_options],
  );
  const tableSchema = controller.tableSchema;
  const columns = useMemo(() => {
    return heatPumpColumnsWithCustomFields({
      builtInColumns: indoorUnitColumnDefs({
        projectId,
        isEditor: !readOnly,
        rooms,
        ventilators,
        assetUrlById,
        onDatasheetChange: (row, next) =>
          replaceHeatPumpRow(controller.onWrite, { ...row, datasheet_asset_ids: next }),
        onPhotoChange: (row, next) =>
          replaceHeatPumpRow(controller.onWrite, { ...row, photo_asset_ids: next }),
      }),
      tableSchema,
      rowsComputed: leafSlice.rows_computed,
    });
  }, [
    assetUrlById,
    controller.onWrite,
    leafSlice.rows_computed,
    projectId,
    readOnly,
    rooms,
    tableSchema,
    ventilators,
  ]);
  const tableView = controller;
  const openIndoorEquipLink = useCallback(
    (rowId: string) => {
      const row = slice.indoor_equip.find((candidate) => candidate.id === rowId);
      if (row) setModal({ kind: "indoor-equip", row });
    },
    [slice.indoor_equip],
  );
  const openOutdoorUnitLink = useCallback(
    (rowId: string) => {
      const row = slice.outdoor_units.find((candidate) => candidate.id === rowId);
      if (row) setModal({ kind: "outdoor-unit", row });
    },
    [slice.outdoor_units],
  );
  const openVentilatorLink = useCallback(
    (rowId: string) => {
      const row = ventilators.find((candidate) => candidate.id === rowId);
      if (row) setModal({ kind: "ventilator", row });
    },
    [ventilators],
  );
  const linkedRecordOps = useMemo<ReadonlyMap<string, LinkedRecordCellOps>>(() => {
    const manufacturerOptions =
      slice.single_select_options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [];
    const indoorEquipOps = buildLinkedRecordOps<HeatPumpIndoorEquipRow>({
      fieldDefs,
      targetTablePath: HEAT_PUMP_LINK_TARGETS.indoorEquip,
      targetRows: slice.indoor_equip,
      getRowId: (equip) => equip.id,
      getRecordId: (equip) => indoorEquipLabel(equip, manufacturerOptions),
      getDisplayName: (equip) => equip.model_number,
      onPillClick: openIndoorEquipLink,
    });
    const outdoorUnitOps = buildLinkedRecordOps<HeatPumpOutdoorUnitRow>({
      fieldDefs,
      targetTablePath: HEAT_PUMP_LINK_TARGETS.outdoorUnits,
      targetRows: slice.outdoor_units,
      getRowId: (unit) => unit.id,
      getRecordId: (unit) => outdoorUnitLabel(unit),
      onPillClick: openOutdoorUnitLink,
    });
    const roomOps = buildLinkedRecordOps<RoomRow>({
      fieldDefs,
      targetTablePath: ["rooms"],
      targetRows: rooms,
      getRowId: (room) => room.id,
      getRecordId: (room) => {
        const label = roomLabel(room);
        return label.length > 0 ? label : null;
      },
      // Chip click opens the standard Room modal in place. The
      // /spaces/rooms?focus=...&open=1 route exists for external deep links.
      onPillClick: setLinkedRoomId,
    });
    const ventilatorOps = buildLinkedRecordOps<VentilatorRow>({
      fieldDefs,
      targetTablePath: HEAT_PUMP_LINK_TARGETS.ventilators,
      targetRows: ventilators,
      getRowId: (ventilator) => ventilator.id,
      getRecordId: (ventilator) => ventilatorLabel(ventilator),
      onPillClick: openVentilatorLink,
    });
    const next = new Map<string, LinkedRecordCellOps>([
      ...indoorEquipOps,
      ...outdoorUnitOps,
      ...roomOps,
      ...ventilatorOps,
    ]);
    if (roomsQuery.isLoading) {
      for (const [key, ops] of roomOps) {
        next.set(key, { ...ops, isLoading: true });
      }
    }
    if (ventilatorsQuery.isLoading) {
      for (const [key, ops] of ventilatorOps) {
        next.set(key, { ...ops, isLoading: true });
      }
    }
    return next;
  }, [
    fieldDefs,
    openIndoorEquipLink,
    openOutdoorUnitLink,
    openVentilatorLink,
    rooms,
    roomsQuery.isLoading,
    slice.indoor_equip,
    slice.outdoor_units,
    slice.single_select_options,
    ventilators,
    ventilatorsQuery.isLoading,
  ]);

  // IndoorUnitRowModal does not expose inline-create for any options.
  // IndoorEquipRowModal — opened from this table for equip-create — creates
  // manufacturer / model_type / install_type options, all owned by the
  // indoor-equip leaf, so the generic editOptions mutation routes through the
  // sibling indoor-equip controller.
  const createOption = makeHeatPumpOptionCreator({
    controller: indoorEquipController,
    tableKey: "heat_pumps_indoor_equip",
    optionsByKey: slice.single_select_options,
  });

  async function addUnit(row: HeatPumpIndoorUnitRow) {
    const tag = uniqueTagForAdd(row.tag, slice.indoor_units);
    await insertHeatPumpRow(controller.onWrite, { ...row, tag });
    setModal(null);
  }

  async function replaceUnit(row: HeatPumpIndoorUnitRow) {
    await replaceHeatPumpRow(controller.onWrite, row);
    setModal(null);
  }

  async function replaceIndoorEquip(row: HeatPumpIndoorEquipRow) {
    await replaceHeatPumpRow(indoorEquipController.onWrite, row);
    setModal(null);
  }

  async function replaceOutdoorUnit(row: HeatPumpOutdoorUnitRow) {
    await replaceHeatPumpRow(outdoorUnitsController.onWrite, row);
    setModal(null);
  }

  async function deleteUnit(row: HeatPumpIndoorUnitRow) {
    setModal(null);
    try {
      await deleteHeatPumpRow(controller.onWrite, row);
    } catch (err) {
      handleDeleteError(err);
    }
  }

  async function addIndoorEquipAndSelect(equip: HeatPumpIndoorEquipRow, unitId: string) {
    await insertHeatPumpRow(indoorEquipController.onWrite, equip);
    const unit = slice.indoor_units.find((candidate) => candidate.id === unitId);
    setModal({
      kind: "unit",
      mode: unit ? "edit" : "add",
      row: unit
        ? { ...unit, indoor_equip_id: equip.id }
        : buildEmptyIndoorUnitRow({ id: unitId, indoor_equip_id: equip.id }),
    });
  }

  function handleDeleteError(err: unknown) {
    if (err instanceof ApiRequestError && err.status === 409) {
      const referenced = (err.details.referenced_by as CascadeReference[] | undefined) ?? [];
      setBlockedDialog({ message: err.message, affected: referenced });
    } else {
      setBlockedDialog({
        message: errorMessage(err, "Could not delete indoor unit."),
        affected: [],
      });
    }
  }

  return (
    <>
      {tableView.viewLoading ? (
        <p className="form-note">Loading table view...</p>
      ) : (
        <DataTable
          tableName="Heat Pump Indoor Units"
          rows={rows}
          focusRowId={focusRowId}
          getRowId={(row) => row.id}
          fieldDefs={fieldDefs}
          columnDefs={columns}
          view={tableView.view}
          onViewChange={tableView.onViewChange}
          onResetView={tableView.onResetView}
          onWrite={controller.onWrite}
          readOnly={readOnly}
          emptyMessage={
            noEquip
              ? "No indoor units yet. Add an indoor equipment row first under Equipment — Indoor."
              : "No indoor units yet."
          }
          onRowOpen={(row) => setModal({ kind: "unit", mode: "edit", row })}
          sessionKey={`${projectId}:heat-pumps:indoor-units:${slice.version_id}`}
          generateRowId={() => buildEmptyIndoorUnitRow().id}
          linkedRecordOps={linkedRecordOps}
          footerAction={
            readOnly ? null : (
              <button
                type="button"
                className="data-table-add-row-button"
                aria-label="Add indoor unit"
                title={
                  noEquip
                    ? "Add an indoor equipment row first under Equipment — Indoor"
                    : "Add indoor unit"
                }
                disabled={noEquip}
                onClick={() =>
                  setModal({
                    kind: "unit",
                    mode: "add",
                    row: buildEmptyIndoorUnitRow({
                      indoor_equip_id: slice.indoor_equip[0]?.id ?? "",
                    }),
                  })
                }
              >
                +
              </button>
            )
          }
          {...customFieldActionsForController(controller)}
        />
      )}
      {linkedRoomId && roomsQuery.data ? (
        <LinkedRoomDialogHost
          projectId={projectId}
          activeVersionId={slice.version_id}
          accessMode={accessMode}
          versionLocked={versionLocked}
          roomsSlice={roomsQuery.data}
          refetch={roomsQuery.refetch}
          roomId={linkedRoomId}
          onClose={() => setLinkedRoomId(null)}
        />
      ) : null}
      {modal?.kind === "unit" ? (
        <IndoorUnitRowModal
          mode={modal.mode}
          row={modal.row}
          indoorEquip={slice.indoor_equip}
          outdoorUnits={slice.outdoor_units}
          ventilators={ventilators}
          existingUnits={slice.indoor_units}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addUnit : replaceUnit}
          onDelete={modal.mode === "edit" ? () => void deleteUnit(modal.row) : undefined}
          onCreateIndoorEquip={() =>
            setModal({
              kind: "equip-create",
              row: buildEmptyIndoorEquipRow(),
              selectForUnitId: modal.row.id,
            })
          }
        />
      ) : null}
      {modal?.kind === "equip-create" ? (
        <IndoorEquipRowModal
          mode="add"
          row={modal.row}
          options={slice.single_select_options}
          readOnly={false}
          onCancel={() => setModal(null)}
          onSubmit={(equip) => addIndoorEquipAndSelect(equip, modal.selectForUnitId)}
          onCreateOption={createOption}
        />
      ) : null}
      {modal?.kind === "indoor-equip" ? (
        <IndoorEquipRowModal
          mode="edit"
          row={modal.row}
          existingEquip={slice.indoor_equip}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={replaceIndoorEquip}
          onCreateOption={readOnly ? undefined : createOption}
        />
      ) : null}
      {modal?.kind === "outdoor-unit" ? (
        <OutdoorUnitRowModal
          mode="edit"
          row={modal.row}
          outdoorEquip={slice.outdoor_equip}
          existingUnits={slice.outdoor_units}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={replaceOutdoorUnit}
        />
      ) : null}
      {modal?.kind === "ventilator" ? (
        <LinkedVentilatorModalHost
          projectId={projectId}
          versionId={slice.version_id}
          ventilatorsSlice={ventilatorsQuery.data ?? null}
          row={modal.row}
          readOnly={readOnly}
          onClose={() => setModal(null)}
        />
      ) : null}
      {blockedDialog ? (
        <BlockedDeleteDialog
          title="Cannot delete"
          message={blockedDialog.message}
          affected={blockedDialog.affected}
          onClose={() => setBlockedDialog(null)}
        />
      ) : null}
    </>
  );
}
