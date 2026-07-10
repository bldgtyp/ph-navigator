import { generatedId } from "../../../shared/lib/ids";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import { APPLIANCE_ID_PREFIX } from "../lib";
import { APPLIANCES_TABLE_NAME, type ApplianceRow, type AppliancesSlice } from "../types";
import { AppliancesTable } from "./AppliancesTable";

export type AppliancesTableSlotProps = {
  controller: SliceTableController<AppliancesSlice>;
  appliancesSlice: AppliancesSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<ApplianceRow>;
  footerAction: React.ReactNode;
  focusRowId?: string | null;
};

export function AppliancesTableSlot(props: AppliancesTableSlotProps) {
  const {
    controller,
    appliancesSlice,
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
    <AppliancesTable
      appliancesSlice={appliancesSlice}
      tableSchema={controller.tableSchema}
      isEditor={controller.canEdit}
      projectId={projectId}
      view={controller.view as ViewState}
      onViewChange={controller.onViewChange}
      onResetView={controller.onResetView}
      onWrite={controller.onWrite}
      buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
      generateRowId={controller.canEdit ? () => generatedId(APPLIANCE_ID_PREFIX) : undefined}
      sessionKey={`${projectId}:${activeVersionId ?? "none"}:${APPLIANCES_TABLE_NAME}`}
      footerAction={footerAction}
      focusRowId={focusRowId}
      {...customFieldActionsForController(controller)}
    />
  );
}
