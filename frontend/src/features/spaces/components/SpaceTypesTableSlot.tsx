import { useRef } from "react";
import { generatedId } from "../../../shared/lib/ids";
import {
  type BuildEmptyRow,
  useRowFocusHighlight,
  type ViewState,
} from "../../../shared/ui/data-table";
import {
  customFieldActionsForController,
  type SliceTableController,
} from "../../../shared/ui/data-table/feature";
import {
  SPACE_TYPE_ID_PREFIX,
  SPACE_TYPES_TABLE_NAME,
  type InverseLinkField,
  type SpaceTypeRow,
  type SpaceTypesSlice,
} from "../types";
import { SpaceTypesTable, type LinkedRoomResolver } from "./SpaceTypesTable";

export type SpaceTypesTableSlotProps = {
  controller: SliceTableController<SpaceTypesSlice>;
  spaceTypesSlice: SpaceTypesSlice;
  projectId: string;
  activeVersionId: string | null;
  buildEmptyRow: BuildEmptyRow<SpaceTypeRow>;
  footerAction: React.ReactNode;
  focusRowId?: string | null;
  resolveLinkedRoom: LinkedRoomResolver;
  onInversePillClick?: (field: InverseLinkField, rowId: string) => void;
  onInverseLinkEdit?: (field: InverseLinkField, row: SpaceTypeRow) => void;
};

export function SpaceTypesTableSlot({
  controller,
  spaceTypesSlice,
  projectId,
  activeVersionId,
  buildEmptyRow,
  footerAction,
  focusRowId,
  resolveLinkedRoom,
  onInversePillClick,
  onInverseLinkEdit,
}: SpaceTypesTableSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusDependencyKey = controller.viewLoading
    ? "loading"
    : `ready:${spaceTypesSlice.space_types.length}`;
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
      <SpaceTypesTable
        spaceTypesSlice={spaceTypesSlice}
        tableSchema={controller.tableSchema}
        isEditor={controller.canEdit}
        view={controller.view as ViewState}
        onViewChange={controller.onViewChange}
        onResetView={controller.onResetView}
        onWrite={controller.onWrite}
        buildEmptyRow={controller.canEdit ? buildEmptyRow : undefined}
        generateRowId={controller.canEdit ? () => generatedId(SPACE_TYPE_ID_PREFIX) : undefined}
        sessionKey={`${projectId}:${activeVersionId ?? "none"}:${SPACE_TYPES_TABLE_NAME}`}
        footerAction={footerAction}
        resolveLinkedRoom={resolveLinkedRoom}
        onInversePillClick={onInversePillClick}
        onInverseLinkEdit={onInverseLinkEdit}
        {...customFieldActionsForController(controller)}
      />
    </div>
  );
}
