import { generatedId } from "../../../shared/lib/ids";
import type { SliceTableController } from "../../../shared/ui/data-table/feature";
import type { BuildEmptyRow, ViewState } from "../../../shared/ui/data-table";
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
    />
  );
}
