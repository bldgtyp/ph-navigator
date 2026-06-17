import { useCallback, useMemo, useState } from "react";
import {
  buildLinkedRecordOps,
  DataTable,
  type LinkedRecordCellOps,
} from "../../../../shared/ui/data-table";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../../shared/ui/data-table/feature";
import { useAssetUrls } from "../../../assets/hooks";
import { ventilatorsSliceFeature } from "../../api";
import type { VentilatorRow } from "../../types";
import { useHeatPumpOptionMutation } from "../api";
import {
  buildEmptyIndoorEquipRow,
  buildNewHeatPumpOption,
  deleteHeatPumpRow,
  insertHeatPumpRow,
  replaceHeatPumpRow,
  sortedIndoorEquip,
  sortedIndoorUnits,
  uniqueTagForAdd,
} from "../lib";
import { indoorEquipColumnDefs, indoorEquipFieldDefs } from "../indoor-equip-columns";
import { HEAT_PUMP_LINK_TARGETS, indoorUnitIdsByIndoorEquip } from "../link-fields";
import {
  type HeatPumpIndoorEquipSlice,
  type HeatPumpIndoorEquipRow,
  type HeatPumpIndoorUnitsSlice,
  type HeatPumpIndoorUnitRow,
  type HeatPumpOwnedOptionKey,
  type HeatPumpsSlice,
} from "../types";
import { addRowButton } from "../../routes/equipmentRowActions";
import { IndoorEquipRowModal } from "./IndoorEquipRowModal";
import { IndoorUnitRowModal } from "./IndoorUnitRowModal";
import { appendComputedFieldDefs, heatPumpColumnsWithCustomFields } from "./heatPumpCustomColumns";

type ModalState =
  | { kind: "equip"; mode: "add" | "edit"; row: HeatPumpIndoorEquipRow }
  | { kind: "unit"; row: HeatPumpIndoorUnitRow }
  | null;

export function IndoorEquipTable({
  projectId,
  slice,
  leafSlice,
  controller,
  indoorUnitsController,
}: {
  projectId: string;
  slice: HeatPumpsSlice;
  leafSlice: HeatPumpIndoorEquipSlice;
  controller: SliceTableController<HeatPumpIndoorEquipSlice>;
  indoorUnitsController: SliceTableController<HeatPumpIndoorUnitsSlice>;
  isEditor?: boolean;
  versionLocked?: boolean;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const optionMutation = useHeatPumpOptionMutation(projectId);
  const accessMode = controller.canEdit ? "editor" : "viewer";
  const indoorUnitModalOpen = modal?.kind === "unit";
  const ventilatorsQuery = ventilatorsSliceFeature.useSliceQuery(
    projectId,
    slice.version_id,
    accessMode,
    indoorUnitModalOpen,
  );
  const ventilators: VentilatorRow[] = ventilatorsQuery.data?.ventilators ?? [];
  const rows = useMemo(() => sortedIndoorEquip(slice.indoor_equip), [slice.indoor_equip]);
  const indoorUnits = useMemo(() => sortedIndoorUnits(slice.indoor_units), [slice.indoor_units]);
  const incomingIndoorUnitIdsByRowId = useMemo(
    () => indoorUnitIdsByIndoorEquip(indoorUnits),
    [indoorUnits],
  );
  const assetIds = useMemo(
    () => Array.from(new Set(rows.flatMap((row) => row.datasheet_asset_ids))),
    [rows],
  );
  const assetUrls = useAssetUrls(projectId, assetIds);
  const assetUrlById = useMemo(
    () => new Map((assetUrls.data ?? []).map((item) => [item.asset_id, item])),
    [assetUrls.data],
  );
  const readOnly = !controller.canEdit;
  const openIndoorUnitLink = useCallback(
    (unitId: string) => {
      const row = slice.indoor_units.find((candidate) => candidate.id === unitId);
      if (row) setModal({ kind: "unit", row });
    },
    [slice.indoor_units],
  );
  const fieldDefs = useMemo(
    () =>
      appendComputedFieldDefs(
        controller.tableSchema.fieldDefs,
        indoorEquipFieldDefs(slice.single_select_options),
      ),
    [controller.tableSchema.fieldDefs, slice.single_select_options],
  );
  const tableSchema = controller.tableSchema;
  const linkedRecordOps = useMemo<ReadonlyMap<string, LinkedRecordCellOps>>(
    () =>
      buildLinkedRecordOps<HeatPumpIndoorUnitRow>({
        fieldDefs,
        targetTablePath: HEAT_PUMP_LINK_TARGETS.indoorUnits,
        targetRows: indoorUnits,
        getRowId: (unit) => unit.id,
        getRecordId: (unit) => unit.tag || unit.id,
        onPillClick: openIndoorUnitLink,
      }),
    [fieldDefs, indoorUnits, openIndoorUnitLink],
  );
  const columns = useMemo(() => {
    return heatPumpColumnsWithCustomFields({
      builtInColumns: indoorEquipColumnDefs({
        projectId,
        isEditor: !readOnly,
        assetUrlById,
        onDatasheetChange: (row, next) =>
          replaceHeatPumpRow(controller.onWrite, { ...row, datasheet_asset_ids: next }),
        indoorUnits,
        incomingIndoorUnitIdsByRowId,
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
    projectId,
    readOnly,
    tableSchema,
  ]);
  const tableView = controller;

  async function createOption(optionKey: HeatPumpOwnedOptionKey, label: string): Promise<string> {
    const existing = slice.single_select_options[optionKey] ?? [];
    const newOption = buildNewHeatPumpOption(label, existing);
    await optionMutation.mutateAsync({
      current: slice,
      optionKey,
      patch: { op: "add", option: newOption },
    });
    return newOption.id;
  }

  async function addIndoorRow(row: HeatPumpIndoorEquipRow) {
    const tag = uniqueTagForAdd(row.tag, slice.indoor_equip);
    await insertHeatPumpRow(controller.onWrite, { ...row, tag });
    setModal(null);
  }

  async function replaceIndoorRow(row: HeatPumpIndoorEquipRow) {
    await replaceHeatPumpRow(controller.onWrite, row);
    setModal(null);
  }

  async function replaceIndoorUnit(row: HeatPumpIndoorUnitRow) {
    await replaceHeatPumpRow(indoorUnitsController.onWrite, row);
    setModal(null);
  }

  async function deleteIndoorRow(row: HeatPumpIndoorEquipRow) {
    await deleteHeatPumpRow(controller.onWrite, row);
    setModal(null);
  }

  return (
    <>
      {tableView.viewLoading ? (
        <p className="form-note">Loading table view...</p>
      ) : (
        <DataTable
          rows={rows}
          getRowId={(row) => row.id}
          fieldDefs={fieldDefs}
          columnDefs={columns}
          view={tableView.view}
          onViewChange={tableView.onViewChange}
          onResetView={tableView.onResetView}
          onWrite={controller.onWrite}
          readOnly={readOnly}
          linkedRecordOps={linkedRecordOps}
          emptyMessage="No indoor heat-pump models defined."
          onRowOpen={(row) => setModal({ kind: "equip", mode: "edit", row })}
          sessionKey={`${projectId}:heat-pumps:indoor-equip:${slice.version_id}`}
          generateRowId={() => buildEmptyIndoorEquipRow().id}
          footerAction={addRowButton("Add indoor model", !readOnly, () =>
            setModal({ kind: "equip", mode: "add", row: buildEmptyIndoorEquipRow() }),
          )}
          {...customFieldActionsForController(controller)}
        />
      )}
      {modal?.kind === "equip" ? (
        <IndoorEquipRowModal
          mode={modal.mode}
          row={modal.row}
          existingEquip={slice.indoor_equip}
          options={slice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setModal(null)}
          onSubmit={modal.mode === "add" ? addIndoorRow : replaceIndoorRow}
          onDelete={modal.mode === "edit" ? () => void deleteIndoorRow(modal.row) : undefined}
          onCreateOption={readOnly ? undefined : createOption}
        />
      ) : null}
      {modal?.kind === "unit" ? (
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
    </>
  );
}
