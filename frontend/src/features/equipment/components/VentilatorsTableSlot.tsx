import { useState } from "react";
import { generatedId } from "../../../shared/lib/ids";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import { useHeatPumpPatchMutation, useHeatPumpsQuery } from "../heat-pumps/api";
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
        heatPumpIndoorUnits={heatPumpsSlice?.indoor_units ?? []}
        onEdit={controller.canEdit ? setActiveVentilator : undefined}
        onIncomingIndoorUnitOpen={(rowId) => {
          const row = heatPumpsSlice?.indoor_units.find((unit) => unit.id === rowId) ?? null;
          if (row) setActiveIndoorUnit(row);
        }}
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
    </>
  );
}
