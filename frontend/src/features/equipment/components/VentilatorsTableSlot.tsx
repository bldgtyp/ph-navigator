import { useState } from "react";
import { generatedId } from "../../../shared/lib/ids";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import { LinkedRecordPicker } from "../../../shared/ui/data-table/fields/linkedRecord/Picker";
import { useHeatPumpPatchMutation, useHeatPumpsQuery } from "../heat-pumps/api";
import { incomingIndoorUnitIds } from "../heat-pumps/link-fields";
import { IndoorUnitRowModal } from "../heat-pumps/components/IndoorUnitRowModal";
import type { HeatPumpIndoorUnitRow } from "../heat-pumps/types";
import { VENTILATOR_ID_PREFIX } from "../lib";
import { ventilatorCellWritesFromModalRow } from "../lib/ventilatorModalPayload";
import { VENTILATORS_TABLE_NAME, type VentilatorRow, type VentilatorsSlice } from "../types";
import { VentilatorsTable } from "./VentilatorsTable";
import { VentilatorRowModal } from "./VentilatorRowModal";

export type VentilatorsTableSlotProps = {
  controller: SliceTableController<VentilatorsSlice>;
  ventilatorsSlice: VentilatorsSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<VentilatorRow>;
  footerAction: React.ReactNode;
};

export function VentilatorsTableSlot(props: VentilatorsTableSlotProps) {
  const { controller, ventilatorsSlice, projectId, activeVersionId, buildEmptyRow, footerAction } =
    props;
  const [activeVentilator, setActiveVentilator] = useState<VentilatorRow | null>(null);
  const [activeIndoorUnit, setActiveIndoorUnit] = useState<HeatPumpIndoorUnitRow | null>(null);
  const [linkPickerRow, setLinkPickerRow] = useState<VentilatorRow | null>(null);
  const heatPumpsQuery = useHeatPumpsQuery(
    projectId,
    Boolean(activeVersionId),
    controller.canEdit ? "editor" : "viewer",
  );
  const heatPumpPatchMutation = useHeatPumpPatchMutation(projectId);
  if (controller.viewLoading) {
    return <p className="form-note">Loading table view...</p>;
  }
  const heatPumpsSlice = heatPumpsQuery.data ?? null;
  const indoorUnits = heatPumpsSlice?.indoor_units ?? [];
  const incomingIndoorUnitIdsByVentilatorId = groupIndoorUnitIdsByVentilator(indoorUnits);
  const readOnly = !controller.canEdit;
  const saveVentilator = async (row: VentilatorRow) => {
    await controller.onWrite({
      kind: "cell",
      writes: ventilatorCellWritesFromModalRow(row),
    });
    setActiveVentilator(null);
  };
  const saveIndoorUnit = async (row: HeatPumpIndoorUnitRow) => {
    if (!heatPumpsSlice) return;
    await heatPumpPatchMutation.mutateAsync({
      current: heatPumpsSlice,
      table: "indoor-units",
      patch: { op: "replace", path: `/${row.id}`, value: row },
    });
    setActiveIndoorUnit(null);
  };
  const linkIndoorUnits = async (ventilator: VentilatorRow, unitIds: readonly string[]) => {
    if (!heatPumpsSlice) return;
    const selected = new Set(unitIds);
    const writes = indoorUnits
      .filter((unit) => selected.has(unit.id) && unit.linked_erv_unit_id !== ventilator.id)
      .map((unit) => ({ ...unit, linked_erv_unit_id: ventilator.id }));
    for (const row of writes) {
      await heatPumpPatchMutation.mutateAsync({
        current: heatPumpsSlice,
        table: "indoor-units",
        patch: { op: "replace", path: `/${row.id}`, value: row },
      });
    }
    setLinkPickerRow(null);
  };
  return (
    <>
      <VentilatorsTable
        ventilatorsSlice={ventilatorsSlice}
        tableSchema={controller.tableSchema}
        isEditor={controller.canEdit}
        view={controller.view as ViewState}
        onViewChange={controller.onViewChange}
        onResetView={controller.onResetView}
        onWrite={controller.onWrite}
        buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
        generateRowId={controller.canEdit ? () => generatedId(VENTILATOR_ID_PREFIX) : undefined}
        sessionKey={`${projectId}:${activeVersionId ?? "none"}:${VENTILATORS_TABLE_NAME}`}
        footerAction={footerAction}
        heatPumpIndoorUnits={indoorUnits}
        onEdit={controller.canEdit ? setActiveVentilator : undefined}
        onIncomingIndoorUnitOpen={(rowId) => {
          const row = indoorUnits.find((unit) => unit.id === rowId) ?? null;
          if (row) setActiveIndoorUnit(row);
        }}
        onIncomingIndoorUnitsLinkEdit={controller.canEdit ? setLinkPickerRow : undefined}
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
      {activeIndoorUnit && heatPumpsSlice ? (
        <IndoorUnitRowModal
          mode="edit"
          row={activeIndoorUnit}
          indoorEquip={heatPumpsSlice.indoor_equip}
          outdoorUnits={heatPumpsSlice.outdoor_units}
          ventilators={ventilatorsSlice.ventilators}
          existingUnits={heatPumpsSlice.indoor_units}
          options={heatPumpsSlice.single_select_options}
          readOnly={readOnly}
          onCancel={() => setActiveIndoorUnit(null)}
          onSubmit={saveIndoorUnit}
        />
      ) : null}
      {linkPickerRow ? (
        <LinkedRecordPicker
          open
          mode="multi"
          selectedIds={incomingIndoorUnitIds(incomingIndoorUnitIdsByVentilatorId, linkPickerRow.id)}
          candidates={indoorUnits.map((unit) => ({
            rowId: unit.id,
            recordId: unit.tag || unit.id,
          }))}
          title="Link HP indoor units"
          onCancel={() => setLinkPickerRow(null)}
          onConfirm={(ids) => void linkIndoorUnits(linkPickerRow, ids)}
        />
      ) : null}
    </>
  );
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
