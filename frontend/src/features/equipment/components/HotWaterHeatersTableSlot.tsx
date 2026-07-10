import { generatedId } from "../../../shared/lib/ids";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import { HOT_WATER_HEATER_ID_PREFIX } from "../lib";
import {
  HOT_WATER_HEATERS_TABLE_NAME,
  type HotWaterHeaterRow,
  type HotWaterHeatersSlice,
} from "../types";
import { HotWaterHeatersTable } from "./HotWaterHeatersTable";

export type HotWaterHeatersTableSlotProps = {
  controller: SliceTableController<HotWaterHeatersSlice>;
  hotWaterHeatersSlice: HotWaterHeatersSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<HotWaterHeaterRow>;
  footerAction: React.ReactNode;
  focusRowId?: string | null;
};

export function HotWaterHeatersTableSlot(props: HotWaterHeatersTableSlotProps) {
  const {
    controller,
    hotWaterHeatersSlice,
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
    <HotWaterHeatersTable
      hotWaterHeatersSlice={hotWaterHeatersSlice}
      tableSchema={controller.tableSchema}
      isEditor={controller.canEdit}
      projectId={projectId}
      view={controller.view as ViewState}
      onViewChange={controller.onViewChange}
      onResetView={controller.onResetView}
      onWrite={controller.onWrite}
      buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
      generateRowId={controller.canEdit ? () => generatedId(HOT_WATER_HEATER_ID_PREFIX) : undefined}
      sessionKey={`${projectId}:${activeVersionId ?? "none"}:${HOT_WATER_HEATERS_TABLE_NAME}`}
      footerAction={footerAction}
      focusRowId={focusRowId}
      {...customFieldActionsForController(controller)}
    />
  );
}
