import { generatedId } from "../../../shared/lib/ids";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import { ELECTRIC_HEATER_ID_PREFIX } from "../lib";
import {
  ELECTRIC_HEATERS_TABLE_NAME,
  type ElectricHeaterRow,
  type ElectricHeatersSlice,
} from "../types";
import { ElectricHeatersTable } from "./ElectricHeatersTable";

export type ElectricHeatersTableSlotProps = {
  controller: SliceTableController<ElectricHeatersSlice>;
  electricHeatersSlice: ElectricHeatersSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<ElectricHeaterRow>;
  footerAction: React.ReactNode;
  focusRowId?: string | null;
};

export function ElectricHeatersTableSlot(props: ElectricHeatersTableSlotProps) {
  const {
    controller,
    electricHeatersSlice,
    projectId,
    activeVersionId,
    buildEmptyRow,
    footerAction,
    focusRowId,
  } = props;
  if (controller.viewLoading) {
    return <p className="form-note">Loading table view...</p>;
  }
  return (
    <ElectricHeatersTable
      electricHeatersSlice={electricHeatersSlice}
      tableSchema={controller.tableSchema}
      isEditor={controller.canEdit}
      projectId={projectId}
      view={controller.view as ViewState}
      onViewChange={controller.onViewChange}
      onResetView={controller.onResetView}
      onWrite={controller.onWrite}
      buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
      generateRowId={controller.canEdit ? () => generatedId(ELECTRIC_HEATER_ID_PREFIX) : undefined}
      sessionKey={`${projectId}:${activeVersionId ?? "none"}:${ELECTRIC_HEATERS_TABLE_NAME}`}
      footerAction={footerAction}
      focusRowId={focusRowId}
      {...customFieldActionsForController(controller)}
    />
  );
}
