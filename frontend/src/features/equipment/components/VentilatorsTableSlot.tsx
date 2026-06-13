import { useMemo } from "react";
import { generatedId } from "../../../shared/lib/ids";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import { useHeatPumpsQuery } from "../heat-pumps/api";
import { VENTILATOR_ID_PREFIX } from "../lib";
import { VENTILATORS_TABLE_NAME, type VentilatorRow, type VentilatorsSlice } from "../types";
import { VentilatorsTable } from "./VentilatorsTable";

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
  const heatPumpsQuery = useHeatPumpsQuery(
    projectId,
    Boolean(activeVersionId),
    controller.canEdit ? "editor" : "viewer",
  );
  // Undefined-vs-empty-Map distinguishes "still loading" from "loaded with
  // no links". The table renders an em-dash for undefined so unhiding the
  // column on cold load doesn't show misleading zeroes.
  const linkedHpIndoorCountById = useMemo<Map<string, number> | undefined>(() => {
    if (!heatPumpsQuery.data) return undefined;
    const counts = new Map<string, number>();
    for (const unit of heatPumpsQuery.data.indoor_units) {
      if (unit.linked_erv_unit_id) {
        counts.set(unit.linked_erv_unit_id, (counts.get(unit.linked_erv_unit_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [heatPumpsQuery.data]);
  if (controller.viewLoading) {
    return <p className="form-note">Loading table view...</p>;
  }
  return (
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
      {...customFieldActionsForController(controller)}
      linkedHpIndoorCountById={linkedHpIndoorCountById}
    />
  );
}
