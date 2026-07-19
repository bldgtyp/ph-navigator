import { useCallback, useMemo, useState } from "react";
import { ApiRequestError } from "../../../../shared/api/client";
import { errorMessage } from "../../../../shared/lib/errors";
import {
  IncomingLinkPicker,
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
import { ventilatorsSliceFeature } from "../../api";
import type { VentilatorRow } from "../../types";
import { heatPumpOutdoorUnitsSliceFeature } from "../api";
import {
  buildEmptyOutdoorEquipRow,
  buildEmptyOutdoorUnitRow,
  deleteHeatPumpRow,
  heatPumpOutdoorUnitsPayloadBuilders,
  insertHeatPumpRow,
  makeHeatPumpOptionCreator,
  outdoorEquipLabel,
  replaceHeatPumpRow,
  sortedIndoorUnits,
  sortedOutdoorEquip,
  sortedOutdoorUnits,
  uniqueTagForAdd,
} from "../lib";
import { outdoorUnitColumnDefs, outdoorUnitFieldDefs } from "../outdoor-unit-columns";
import {
  HEAT_PUMP_LINK_TARGETS,
  incomingIndoorUnitIds,
  indoorUnitIdsByOutdoorUnit,
} from "../link-fields";
import {
  HEAT_PUMP_OPTION_KEYS,
  type CascadeReference,
  type HeatPumpIndoorUnitRow,
  type HeatPumpIndoorUnitsSlice,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpOutdoorEquipSlice,
  type HeatPumpOutdoorUnitsSlice,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "../types";
import { OutdoorEquipRowModal } from "./OutdoorEquipRowModal";
import { IndoorUnitRowModal } from "./IndoorUnitRowModal";
import { OutdoorUnitRowModal } from "./OutdoorUnitRowModal";
import { BlockedDeleteDialog, CascadePreviewDialog } from "./CascadePreviewDialog";
import { heatPumpColumnsWithCustomFields } from "./heatPumpCustomColumns";

type ModalState =
  | { kind: "unit"; mode: "add" | "edit"; row: HeatPumpOutdoorUnitRow }
  | { kind: "indoor-unit"; row: HeatPumpIndoorUnitRow }
  | { kind: "outdoor-equip"; row: HeatPumpOutdoorEquipRow }
  | { kind: "equip-create"; row: HeatPumpOutdoorEquipRow; selectForUnitId: string }
  | null;

type DeleteState = {
  kind: "preview";
  row: HeatPumpOutdoorUnitRow;
  affected: CascadeReference[];
} | null;

const EMPTY_HEAT_PUMP_OPTIONS: HeatPumpsSlice["single_select_options"][string] = [];

export function OutdoorUnitsTable({
  projectId,
  slice,
  leafSlice,
  controller,
  indoorUnitsController,
  outdoorEquipController,
  focusRowId,
}: {
  projectId: string;
  slice: HeatPumpsSlice;
  leafSlice: HeatPumpOutdoorUnitsSlice;
  controller: SliceTableController<HeatPumpOutdoorUnitsSlice>;
  indoorUnitsController: SliceTableController<HeatPumpIndoorUnitsSlice>;
  outdoorEquipController: SliceTableController<HeatPumpOutdoorEquipSlice>;
  focusRowId?: string | null;
  isEditor?: boolean;
  versionLocked: boolean;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const [linkPickerRow, setLinkPickerRow] = useState<HeatPumpOutdoorUnitRow | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState>(null);
  const [blockedDialog, setBlockedDialog] = useState<{
    message: string;
    affected: CascadeReference[];
  } | null>(null);
  const accessMode = controller.canEdit ? "editor" : "viewer";
  const indoorUnitModalOpen = modal?.kind === "indoor-unit";
  const ventilatorsQuery = ventilatorsSliceFeature.useSliceQuery(
    projectId,
    slice.version_id,
    accessMode,
    indoorUnitModalOpen,
  );
  const ventilators: VentilatorRow[] = ventilatorsQuery.data?.ventilators ?? [];
  const rows = useMemo(() => sortedOutdoorUnits(slice.outdoor_units), [slice.outdoor_units]);
  const indoorUnits = useMemo(() => sortedIndoorUnits(slice.indoor_units), [slice.indoor_units]);
  const outdoorEquip = useMemo(
    () => sortedOutdoorEquip(slice.outdoor_equip),
    [slice.outdoor_equip],
  );
  const incomingIndoorUnitIdsByRowId = useMemo(
    () => indoorUnitIdsByOutdoorUnit(indoorUnits),
    [indoorUnits],
  );
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
  const noEquip = slice.outdoor_equip.length === 0;
  const openIndoorUnitLink = useCallback(
    (unitId: string) => {
      const row = slice.indoor_units.find((candidate) => candidate.id === unitId);
      if (row) setModal({ kind: "indoor-unit", row });
    },
    [slice.indoor_units],
  );
  const openOutdoorEquipLink = useCallback(
    (equipId: string) => {
      const row = slice.outdoor_equip.find((candidate) => candidate.id === equipId);
      if (row) setModal({ kind: "outdoor-equip", row });
    },
    [slice.outdoor_equip],
  );
  const fieldDefs = useMemo(
    () =>
      fieldDefsWithRenderOverrides(
        controller.tableSchema.fieldDefs,
        outdoorUnitFieldDefs(slice.single_select_options),
      ),
    [controller.tableSchema.fieldDefs, slice.single_select_options],
  );
  const tableSchema = controller.tableSchema;
  const manufacturerOptions =
    slice.single_select_options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? EMPTY_HEAT_PUMP_OPTIONS;
  const linkedRecordOps = useMemo<ReadonlyMap<string, LinkedRecordCellOps>>(() => {
    const outdoorEquipOps = buildLinkedRecordOps<HeatPumpOutdoorEquipRow>({
      fieldDefs,
      targetTablePath: HEAT_PUMP_LINK_TARGETS.outdoorEquip,
      targetRows: outdoorEquip,
      getRowId: (equip) => equip.id,
      getRecordId: (equip) => outdoorEquipLabel(equip, manufacturerOptions),
      onPillClick: openOutdoorEquipLink,
    });
    const indoorUnitOps = buildLinkedRecordOps<HeatPumpIndoorUnitRow>({
      fieldDefs,
      targetTablePath: HEAT_PUMP_LINK_TARGETS.indoorUnits,
      targetRows: indoorUnits,
      getRowId: (unit) => unit.id,
      getRecordId: (unit) => unit.tag || unit.id,
      onPillClick: openIndoorUnitLink,
    });
    return new Map([...outdoorEquipOps, ...indoorUnitOps]);
  }, [
    fieldDefs,
    indoorUnits,
    openIndoorUnitLink,
    openOutdoorEquipLink,
    outdoorEquip,
    manufacturerOptions,
  ]);
  const columns = useMemo(() => {
    return heatPumpColumnsWithCustomFields({
      builtInColumns: outdoorUnitColumnDefs({
        projectId,
        isEditor: !readOnly,
        assetUrlById,
        onDatasheetChange: async (row, next) => {
          await replaceHeatPumpRow(controller.onWrite, { ...row, datasheet_asset_ids: next });
        },
        onPhotoChange: async (row, next) => {
          await replaceHeatPumpRow(controller.onWrite, { ...row, photo_asset_ids: next });
        },
        indoorUnits,
        incomingIndoorUnitIdsByRowId,
        onIndoorUnitClick: openIndoorUnitLink,
        onIndoorUnitsLinkEdit: (row) => setLinkPickerRow(row),
      }),
      tableSchema,
      rowsComputed: leafSlice.rows_computed,
    });
  }, [
    assetUrlById,
    controller.onWrite,
    incomingIndoorUnitIdsByRowId,
    indoorUnits,
    leafSlice.rows_computed,
    openIndoorUnitLink,
    projectId,
    readOnly,
    tableSchema,
  ]);
  const tableView = controller;

  // The paired OutdoorEquipRowModal creates manufacturer/system_family/
  // refrigerant options — all owned by the outdoor-equip leaf — so the generic
  // editOptions mutation routes through the sibling outdoor-equip controller.
  const createOption = makeHeatPumpOptionCreator({
    controller: outdoorEquipController,
    tableKey: "heat_pumps_outdoor_equip",
    optionsByKey: slice.single_select_options,
  });

  async function addUnit(row: HeatPumpOutdoorUnitRow) {
    const tag = uniqueTagForAdd(row.tag, slice.outdoor_units);
    await insertHeatPumpRow(controller.onWrite, { ...row, tag });
    setModal(null);
  }

  async function replaceUnit(row: HeatPumpOutdoorUnitRow) {
    await replaceHeatPumpRow(controller.onWrite, row);
    setModal(null);
  }

  async function replaceOutdoorEquip(row: HeatPumpOutdoorEquipRow) {
    await replaceHeatPumpRow(outdoorEquipController.onWrite, row);
    setModal(null);
  }

  async function replaceIndoorUnit(row: HeatPumpIndoorUnitRow) {
    await replaceHeatPumpRow(indoorUnitsController.onWrite, row);
    setModal(null);
  }

  async function linkIndoorUnits(unit: HeatPumpOutdoorUnitRow, unitIds: readonly string[]) {
    const selected = new Set(unitIds);
    const writes = indoorUnits
      .filter((indoorUnit) => selected.has(indoorUnit.id) && indoorUnit.outdoor_unit_id !== unit.id)
      .map((indoorUnit) => ({ ...indoorUnit, outdoor_unit_id: unit.id }));
    for (const indoorUnit of writes) {
      await replaceHeatPumpRow(indoorUnitsController.onWrite, indoorUnit);
    }
    setLinkPickerRow(null);
  }

  async function addOutdoorEquipAndSelect(equip: HeatPumpOutdoorEquipRow, unitId: string) {
    await insertHeatPumpRow(outdoorEquipController.onWrite, equip);
    const unit = slice.outdoor_units.find((candidate) => candidate.id === unitId);
    setModal({
      kind: "unit",
      mode: unit ? "edit" : "add",
      row: unit
        ? { ...unit, outdoor_equip_id: equip.id }
        : buildEmptyOutdoorUnitRow({ id: unitId, outdoor_equip_id: equip.id }),
    });
  }

  async function startDelete(row: HeatPumpOutdoorUnitRow) {
    setModal(null);
    try {
      // Dry-run the generic slice-replace (minus this row) to surface the
      // cascade before the user confirms. The backend clears the dependent
      // links on the real delete below; here we only preview them.
      const preview = await controller.runCoordinatedWrite(
        {
          label: "heat_pump_outdoor_units:deletePreview",
          run: async () => {
            const writableLeafSlice = await controller.resolveSliceForWrite();
            const previewPayload = heatPumpOutdoorUnitsPayloadBuilders.fromRowDelete(
              writableLeafSlice,
              [{ rowId: row.id, row, anchorRowId: null }],
            );
            return heatPumpOutdoorUnitsSliceFeature.previewReplace(
              projectId,
              writableLeafSlice.version_id,
              writableLeafSlice,
              previewPayload,
            );
          },
        },
        "The draft changed before this delete preview was computed.",
        "Could not preview outdoor-unit deletion.",
      );
      if (!preview) return;
      if (preview.affected.length === 0) {
        await deleteHeatPumpRow(controller.onWrite, row);
        return;
      }
      setDeleteState({ kind: "preview", row, affected: preview.affected });
    } catch (err) {
      setBlockedDialog({
        message: errorMessage(err, "Could not delete outdoor unit."),
        affected: [],
      });
    }
  }

  async function confirmDelete(row: HeatPumpOutdoorUnitRow) {
    // The generic replace path reads the controller's live slice, so its
    // etag headers already reflect any mutation that landed while the
    // confirmation dialog was open.
    try {
      await deleteHeatPumpRow(controller.onWrite, row);
      setDeleteState(null);
    } catch (err) {
      setDeleteState(null);
      handleDeleteError(err);
    }
  }

  function handleDeleteError(err: unknown) {
    if (err instanceof ApiRequestError && err.status === 409) {
      const referenced = (err.details.referenced_by as CascadeReference[] | undefined) ?? [];
      setBlockedDialog({ message: err.message, affected: referenced });
    } else {
      setBlockedDialog({
        message: errorMessage(err, "Could not delete outdoor unit."),
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
          tableName="Heat Pump Outdoor Units"
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
          linkedRecordOps={linkedRecordOps}
          emptyMessage={
            noEquip
              ? "No outdoor units yet. Add an outdoor equipment row first under Equipment — Outdoor."
              : "No outdoor units yet."
          }
          onRowOpen={(row) => setModal({ kind: "unit", mode: "edit", row })}
          sessionKey={`${projectId}:heat-pumps:outdoor-units:${slice.version_id}`}
          generateRowId={() => buildEmptyOutdoorUnitRow().id}
          footerAction={
            readOnly ? null : (
              <button
                type="button"
                className="data-table-add-row-button"
                aria-label="Add outdoor unit"
                title={
                  noEquip
                    ? "Add an outdoor equipment row first under Equipment — Outdoor"
                    : "Add outdoor unit"
                }
                disabled={noEquip}
                onClick={() =>
                  setModal({
                    kind: "unit",
                    mode: "add",
                    row: buildEmptyOutdoorUnitRow({
                      outdoor_equip_id: slice.outdoor_equip[0]?.id ?? "",
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
      {modal?.kind === "unit" ? (
        <OutdoorUnitRowModal
          mode={modal.mode}
          row={modal.row}
          outdoorEquip={slice.outdoor_equip}
          existingUnits={slice.outdoor_units}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addUnit : replaceUnit}
          onDelete={modal.mode === "edit" ? () => void startDelete(modal.row) : undefined}
          onCreateOutdoorEquip={() =>
            setModal({
              kind: "equip-create",
              row: buildEmptyOutdoorEquipRow(),
              selectForUnitId: modal.row.id,
            })
          }
        />
      ) : null}
      {modal?.kind === "indoor-unit" ? (
        <IndoorUnitRowModal
          mode="edit"
          row={modal.row}
          indoorEquip={slice.indoor_equip}
          outdoorUnits={slice.outdoor_units}
          ventilators={ventilators}
          existingUnits={slice.indoor_units}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={replaceIndoorUnit}
        />
      ) : null}
      {modal?.kind === "outdoor-equip" ? (
        <OutdoorEquipRowModal
          mode="edit"
          row={modal.row}
          existingEquip={slice.outdoor_equip}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={replaceOutdoorEquip}
          onCreateOption={readOnly ? undefined : createOption}
        />
      ) : null}
      {modal?.kind === "equip-create" ? (
        <OutdoorEquipRowModal
          mode="add"
          row={modal.row}
          options={slice.single_select_options}
          readOnly={false}
          onCancel={() => setModal(null)}
          onSubmit={(equip) => addOutdoorEquipAndSelect(equip, modal.selectForUnitId)}
          onCreateOption={createOption}
        />
      ) : null}
      <IncomingLinkPicker
        state={
          linkPickerRow
            ? {
                row: linkPickerRow,
                selectedIds: incomingIndoorUnitIds(incomingIndoorUnitIdsByRowId, linkPickerRow.id),
                candidates: indoorUnits.map((unit) => ({
                  rowId: unit.id,
                  recordId: unit.tag || unit.id,
                })),
                title: "Link Indoor units",
              }
            : null
        }
        onCancel={() => setLinkPickerRow(null)}
        onConfirm={linkIndoorUnits}
      />
      {deleteState?.kind === "preview" ? (
        <CascadePreviewDialog
          title={`Delete outdoor unit ${deleteState.row.tag || ""}?`}
          description={`This will clear the outdoor link on ${deleteState.affected.length} indoor unit(s):`}
          affected={deleteState.affected}
          confirmLabel="Delete and clear links"
          isConfirming={controller.isReplacePending}
          onCancel={() => setDeleteState(null)}
          onConfirm={() => void confirmDelete(deleteState.row)}
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
