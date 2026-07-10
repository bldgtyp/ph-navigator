import { generatedId } from "../../../shared/lib/ids";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import { HOT_WATER_TANK_ID_PREFIX } from "../lib";
import {
  HOT_WATER_TANKS_TABLE_NAME,
  type HotWaterTankRow,
  type HotWaterTanksSlice,
} from "../types";
import { HotWaterTanksTable } from "./HotWaterTanksTable";

export type HotWaterTanksTableSlotProps = {
  controller: SliceTableController<HotWaterTanksSlice>;
  hotWaterTanksSlice: HotWaterTanksSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<HotWaterTankRow>;
  footerAction: React.ReactNode;
  focusRowId?: string | null;
};

export function HotWaterTanksTableSlot(props: HotWaterTanksTableSlotProps) {
  const {
    controller,
    hotWaterTanksSlice,
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
    <HotWaterTanksTable
      hotWaterTanksSlice={hotWaterTanksSlice}
      tableSchema={controller.tableSchema}
      isEditor={controller.canEdit}
      projectId={projectId}
      view={controller.view as ViewState}
      onViewChange={controller.onViewChange}
      onResetView={controller.onResetView}
      onWrite={controller.onWrite}
      buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
      generateRowId={controller.canEdit ? () => generatedId(HOT_WATER_TANK_ID_PREFIX) : undefined}
      sessionKey={`${projectId}:${activeVersionId ?? "none"}:${HOT_WATER_TANKS_TABLE_NAME}`}
      footerAction={footerAction}
      focusRowId={focusRowId}
      {...customFieldActionsForController(controller)}
    />
  );
}
