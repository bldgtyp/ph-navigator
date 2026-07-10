import { generatedId } from "../../../shared/lib/ids";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import { FAN_ID_PREFIX } from "../lib";
import { FANS_TABLE_NAME, type FanRow, type FansSlice } from "../types";
import { FansTable } from "./FansTable";

export type FansTableSlotProps = {
  controller: SliceTableController<FansSlice>;
  fansSlice: FansSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<FanRow>;
  footerAction: React.ReactNode;
  focusRowId?: string | null;
};

export function FansTableSlot(props: FansTableSlotProps) {
  const {
    controller,
    fansSlice,
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
    <FansTable
      fansSlice={fansSlice}
      tableSchema={controller.tableSchema}
      isEditor={controller.canEdit}
      projectId={projectId}
      view={controller.view as ViewState}
      onViewChange={controller.onViewChange}
      onResetView={controller.onResetView}
      onWrite={controller.onWrite}
      buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
      generateRowId={controller.canEdit ? () => generatedId(FAN_ID_PREFIX) : undefined}
      sessionKey={`${projectId}:${activeVersionId ?? "none"}:${FANS_TABLE_NAME}`}
      footerAction={footerAction}
      focusRowId={focusRowId}
      {...customFieldActionsForController(controller)}
    />
  );
}
