import { useState } from "react";
import { generatedId } from "../../../shared/lib/ids";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import {
  IncomingLinkPicker,
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
  // The ventilator side edits HP indoor units through the generic indoor-units
  // slice feature: read the leaf (+ the sibling equip / outdoor-unit leaves the
  // modal references for labels) and replace rows through the shared write path.
  const accessMode = controller.canEdit ? "editor" : "viewer";
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
    const payload = heatPumpIndoorUnitsPayloadBuilders.fromCellWrites(
      indoorUnitsSlice,
      writes,
      {},
      {},
    );
    await indoorUnitsReplace.mutateAsync({ current: indoorUnitsSlice, payload });
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
