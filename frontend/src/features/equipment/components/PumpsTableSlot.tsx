import { generatedId } from "../../../shared/lib/ids";
import type { SliceTableController } from "../../../shared/ui/data-table/feature";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
import { PUMP_ID_PREFIX } from "../lib";
import { PUMPS_TABLE_NAME, type PumpRow, type PumpsSlice } from "../types";
import { PumpsTable } from "./PumpsTable";

export type PumpsTableSlotProps = {
  controller: SliceTableController<PumpsSlice>;
  pumpsSlice: PumpsSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<PumpRow>;
  footerAction: React.ReactNode;
};

export function PumpsTableSlot(props: PumpsTableSlotProps) {
  const { controller, pumpsSlice, projectId, activeVersionId, buildEmptyRow, footerAction } = props;
  if (controller.viewLoading) {
    return <p className="form-note">Loading table view...</p>;
  }
  return (
    <PumpsTable
      pumpsSlice={pumpsSlice}
      tableSchema={controller.tableSchema}
      isEditor={controller.canEdit}
      view={controller.view as ViewState}
      onViewChange={controller.onViewChange}
      onResetView={controller.onResetView}
      onWrite={controller.onWrite}
      buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
      generateRowId={controller.canEdit ? () => generatedId(PUMP_ID_PREFIX) : undefined}
      sessionKey={`${projectId}:${activeVersionId ?? "none"}:${PUMPS_TABLE_NAME}`}
      footerAction={footerAction}
    />
  );
}
