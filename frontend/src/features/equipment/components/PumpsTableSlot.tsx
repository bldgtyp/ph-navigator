import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { generatedId } from "../../../shared/lib/ids";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import {
  useRowFocusHighlight,
  type BuildEmptyRow,
  type ViewState,
} from "../../../shared/ui/data-table";
import { PUMP_ID_PREFIX } from "../lib";
import { routeForInverseSource } from "../lib/inverseRoutes";
import { PUMPS_TABLE_NAME, type PumpRow, type PumpsSlice } from "../types";
import { PumpsTable } from "./PumpsTable";

export type PumpsTableSlotProps = {
  controller: SliceTableController<PumpsSlice>;
  pumpsSlice: PumpsSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<PumpRow>;
  footerAction: React.ReactNode;
  // PRD Q19 — `?focus=<row_id>` from a Rooms→Pumps pill click. The slot
  // owns the container ref; `useRowFocusHighlight` scrolls + highlights
  // the matching `<tr data-row-id>`.
  focusRowId?: string | null;
};

export function PumpsTableSlot(props: PumpsTableSlotProps) {
  const {
    controller,
    pumpsSlice,
    projectId,
    activeVersionId,
    buildEmptyRow,
    footerAction,
    focusRowId,
  } = props;
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  // §A5 — `viewLoading` flips false AFTER mount; without a re-trigger
  // the one-shot effect runs once on first paint, can't find the row,
  // and never tries again. Bump `dependencyKey` on the loading edge
  // (and on row-count changes) so the effect re-runs when the table
  // body actually exists in the DOM.
  const focusDependencyKey = controller.viewLoading
    ? "loading"
    : `ready:${pumpsSlice.pumps.length}`;
  useRowFocusHighlight({
    containerRef,
    rowId: focusRowId ?? null,
    dependencyKey: focusDependencyKey,
  });
  if (controller.viewLoading) {
    return (
      <div ref={containerRef}>
        <p className="form-note">Loading table view...</p>
      </div>
    );
  }
  return (
    <div ref={containerRef}>
      <PumpsTable
        pumpsSlice={pumpsSlice}
        tableSchema={controller.tableSchema}
        isEditor={controller.canEdit}
        projectId={projectId}
        view={controller.view as ViewState}
        onViewChange={controller.onViewChange}
        onResetView={controller.onResetView}
        onWrite={controller.onWrite}
        buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
        generateRowId={controller.canEdit ? () => generatedId(PUMP_ID_PREFIX) : undefined}
        sessionKey={`${projectId}:${activeVersionId ?? "none"}:${PUMPS_TABLE_NAME}`}
        footerAction={footerAction}
        {...customFieldActionsForController(controller)}
        onInversePillClick={(field, rowId) => {
          const route = routeForInverseSource(projectId, field, rowId);
          if (route) navigate(route);
        }}
      />
    </div>
  );
}
