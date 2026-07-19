import { useCallback, useMemo, useState } from "react";
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
import {
  buildEmptyOutdoorEquipRow,
  deleteHeatPumpRow,
  indoorEquipLabel,
  insertHeatPumpRow,
  makeHeatPumpOptionCreator,
  replaceHeatPumpRow,
  sortedOutdoorEquip,
  sortedOutdoorUnits,
  uniqueTagForAdd,
} from "../lib";
import {
  HEAT_PUMP_LINK_TARGETS,
  incomingOutdoorUnitIds,
  outdoorUnitIdsByOutdoorEquip,
} from "../link-fields";
import { outdoorEquipColumnDefs, outdoorEquipFieldDefs } from "../outdoor-equip-columns";
import {
  HEAT_PUMP_OPTION_KEYS,
  type HeatPumpOutdoorEquipSlice,
  type HeatPumpOutdoorEquipRow,
  type HeatPumpIndoorEquipSlice,
  type HeatPumpIndoorEquipRow,
  type HeatPumpOutdoorUnitsSlice,
  type HeatPumpOutdoorUnitRow,
  type HeatPumpsSlice,
} from "../types";
import { addRowButton } from "../../../../shared/ui/data-table";
import { IndoorEquipRowModal } from "./IndoorEquipRowModal";
import { OutdoorEquipRowModal } from "./OutdoorEquipRowModal";
import { OutdoorUnitRowModal } from "./OutdoorUnitRowModal";
import { PhiusExportDialog } from "./PhiusExportDialog";
import { heatPumpColumnsWithCustomFields } from "./heatPumpCustomColumns";

type ModalState =
  | { kind: "outdoor"; mode: "add" | "edit"; row: HeatPumpOutdoorEquipRow }
  | { kind: "indoor-equip"; row: HeatPumpIndoorEquipRow }
  | { kind: "unit"; row: HeatPumpOutdoorUnitRow }
  | null;

export function OutdoorEquipTable({
  projectId,
  btNumber,
  slice,
  leafSlice,
  controller,
  indoorEquipController,
  outdoorUnitsController,
  focusRowId,
}: {
  projectId: string;
  btNumber: string;
  slice: HeatPumpsSlice;
  leafSlice: HeatPumpOutdoorEquipSlice;
  controller: SliceTableController<HeatPumpOutdoorEquipSlice>;
  indoorEquipController: SliceTableController<HeatPumpIndoorEquipSlice>;
  outdoorUnitsController: SliceTableController<HeatPumpOutdoorUnitsSlice>;
  focusRowId?: string | null;
  isEditor?: boolean;
  versionLocked?: boolean;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const [linkPickerRow, setLinkPickerRow] = useState<HeatPumpOutdoorEquipRow | null>(null);
  const [phiusDialogOpen, setPhiusDialogOpen] = useState(false);
  const rows = useMemo(() => sortedOutdoorEquip(slice.outdoor_equip), [slice.outdoor_equip]);
  const outdoorUnits = useMemo(
    () => sortedOutdoorUnits(slice.outdoor_units),
    [slice.outdoor_units],
  );
  const incomingOutdoorUnitIdsByRowId = useMemo(
    () => outdoorUnitIdsByOutdoorEquip(outdoorUnits),
    [outdoorUnits],
  );
  const manufacturerOptions = useMemo(
    () => slice.single_select_options[HEAT_PUMP_OPTION_KEYS.manufacturer] ?? [],
    [slice.single_select_options],
  );
  const pairedIndoorEquipLabelById = useMemo(() => {
    const labels = new Map<string, string>();
    for (const equip of slice.indoor_equip) {
      labels.set(equip.id, indoorEquipLabel(equip, manufacturerOptions));
    }
    return labels;
  }, [manufacturerOptions, slice.indoor_equip]);
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
  const openOutdoorUnitLink = useCallback(
    (unitId: string) => {
      const row = slice.outdoor_units.find((candidate) => candidate.id === unitId);
      if (row) setModal({ kind: "unit", row });
    },
    [slice.outdoor_units],
  );
  const openIndoorEquipLink = useCallback(
    (equipId: string) => {
      const row = slice.indoor_equip.find((candidate) => candidate.id === equipId);
      if (row) setModal({ kind: "indoor-equip", row });
    },
    [slice.indoor_equip],
  );
  const fieldDefs = useMemo(
    () =>
      fieldDefsWithRenderOverrides(
        controller.tableSchema.fieldDefs,
        outdoorEquipFieldDefs({ options: slice.single_select_options }),
      ),
    [controller.tableSchema.fieldDefs, slice.single_select_options],
  );
  const tableSchema = controller.tableSchema;
  const columns = useMemo(() => {
    return heatPumpColumnsWithCustomFields({
      builtInColumns: outdoorEquipColumnDefs({
        projectId,
        isEditor: !readOnly,
        assetUrlById,
        onDatasheetChange: async (row, next) => {
          await replaceHeatPumpRow(controller.onWrite, { ...row, datasheet_asset_ids: next });
        },
        onPhotoChange: async (row, next) => {
          await replaceHeatPumpRow(controller.onWrite, { ...row, photo_asset_ids: next });
        },
        outdoorUnits,
        incomingOutdoorUnitIdsByRowId,
        pairedIndoorEquipLabelById,
        onOutdoorUnitClick: openOutdoorUnitLink,
        onOutdoorUnitsLinkEdit: (row) => setLinkPickerRow(row),
      }),
      tableSchema,
      rowsComputed: leafSlice.rows_computed,
    });
  }, [
    assetUrlById,
    controller.onWrite,
    incomingOutdoorUnitIdsByRowId,
    leafSlice.rows_computed,
    outdoorUnits,
    pairedIndoorEquipLabelById,
    openOutdoorUnitLink,
    projectId,
    readOnly,
    tableSchema,
  ]);
  const linkedRecordOps = useMemo<ReadonlyMap<string, LinkedRecordCellOps>>(() => {
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
      targetRows: outdoorUnits,
      getRowId: (unit) => unit.id,
      getRecordId: (unit) => unit.tag || unit.id,
      onPillClick: openOutdoorUnitLink,
    });
    return new Map([...indoorEquipOps, ...outdoorUnitOps]);
  }, [
    fieldDefs,
    manufacturerOptions,
    openIndoorEquipLink,
    openOutdoorUnitLink,
    outdoorUnits,
    slice.indoor_equip,
  ]);
  const tableView = controller;

  // Outdoor-equip owns manufacturer / system_family / refrigerant; create
  // options through the generic editOptions mutation on this leaf's controller.
  const createOption = makeHeatPumpOptionCreator({
    controller,
    tableKey: "heat_pumps_outdoor_equip",
    optionsByKey: slice.single_select_options,
  });

  async function addOutdoorRow(row: HeatPumpOutdoorEquipRow) {
    const tag = uniqueTagForAdd(row.tag, slice.outdoor_equip);
    await insertHeatPumpRow(controller.onWrite, { ...row, tag });
    setModal(null);
  }

  async function replaceOutdoorRow(row: HeatPumpOutdoorEquipRow) {
    await replaceHeatPumpRow(controller.onWrite, row);
    setModal(null);
  }

  async function replaceOutdoorUnit(row: HeatPumpOutdoorUnitRow) {
    await replaceHeatPumpRow(outdoorUnitsController.onWrite, row);
    setModal(null);
  }

  async function replaceIndoorEquip(row: HeatPumpIndoorEquipRow) {
    await replaceHeatPumpRow(indoorEquipController.onWrite, row);
    setModal(null);
  }

  async function linkOutdoorUnits(equip: HeatPumpOutdoorEquipRow, unitIds: readonly string[]) {
    const selected = new Set(unitIds);
    const writes = outdoorUnits
      .filter((unit) => selected.has(unit.id) && unit.outdoor_equip_id !== equip.id)
      .map((unit) => ({ ...unit, outdoor_equip_id: equip.id }));
    for (const unit of writes) {
      await replaceHeatPumpRow(outdoorUnitsController.onWrite, unit);
    }
    setLinkPickerRow(null);
  }

  async function deleteOutdoorRow(row: HeatPumpOutdoorEquipRow) {
    await deleteHeatPumpRow(controller.onWrite, row);
    setModal(null);
  }

  return (
    <>
      {tableView.viewLoading ? (
        <p className="form-note">Loading table view...</p>
      ) : (
        <DataTable
          tableName="Heat Pump Outdoor Equipment"
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
          emptyMessage="No heat-pump outdoor equipment yet."
          onRowOpen={(row) => setModal({ kind: "outdoor", mode: "edit", row })}
          sessionKey={`${projectId}:heat-pumps:outdoor-equip:${slice.version_id}`}
          generateRowId={() => buildEmptyOutdoorEquipRow().id}
          footerAction={addRowButton("Add outdoor equipment", !readOnly, () =>
            setModal({ kind: "outdoor", mode: "add", row: buildEmptyOutdoorEquipRow() }),
          )}
          overflowMenuActions={
            // Phius export is a bulk export → editor-only (CP-7); hidden from
            // viewers. Gates on `isEditor` (access class), not `canEdit`, so an
            // editor on a locked version can still export.
            controller.isEditor ? (
              <button
                type="button"
                className="data-table-menu-item"
                disabled={rows.length === 0}
                title={rows.length === 0 ? "Add an outdoor heat-pump model first." : undefined}
                onClick={() => setPhiusDialogOpen(true)}
              >
                Export to Phius HP Estimator...
              </button>
            ) : null
          }
          {...customFieldActionsForController(controller)}
        />
      )}
      {phiusDialogOpen ? (
        <PhiusExportDialog
          projectId={projectId}
          btNumber={btNumber}
          onClose={() => setPhiusDialogOpen(false)}
        />
      ) : null}
      {modal?.kind === "outdoor" ? (
        <OutdoorEquipRowModal
          mode={modal.mode}
          row={modal.row}
          existingEquip={slice.outdoor_equip}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addOutdoorRow : replaceOutdoorRow}
          onDelete={modal.mode === "edit" ? () => void deleteOutdoorRow(modal.row) : undefined}
          onCreateOption={readOnly ? undefined : createOption}
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
      {modal?.kind === "unit" ? (
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
      <IncomingLinkPicker
        state={
          linkPickerRow
            ? {
                row: linkPickerRow,
                selectedIds: incomingOutdoorUnitIds(
                  incomingOutdoorUnitIdsByRowId,
                  linkPickerRow.id,
                ),
                candidates: outdoorUnits.map((unit) => ({
                  rowId: unit.id,
                  recordId: unit.tag || unit.id,
                })),
                title: "Link Outdoor units",
              }
            : null
        }
        onCancel={() => setLinkPickerRow(null)}
        onConfirm={linkOutdoorUnits}
      />
    </>
  );
}
