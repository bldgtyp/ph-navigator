import "../equipment.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  buildLinkedRecordOps,
  RECORD_ID_FIELD_KEY,
  type FieldDef,
  type LinkedRecordCellOps,
  type LinkedRecordTargetTableOption,
} from "../../../shared/ui/data-table";
import { SliceTableShell } from "../../../shared/ui/data-table/feature";
import type { ProjectDetail } from "../../projects/types";
import { RoomsPageError } from "../components/RoomsPageError";
import { RoomDialogStack, type RoomModalState } from "../components/RoomDialogStack";
import {
  buildAddRoomFooterAction,
  buildRoomsDownloadAction,
} from "../components/RoomsToolbarActions";
import { RoomsTableSlot } from "../components/RoomsTableSlot";
import { usePumpsSliceQuery, useRoomsSliceQuery, useVentilatorsSliceQuery } from "../hooks";
import { useSpaceTypesSliceQuery } from "../../spaces/hooks";
import { customTextValueOrNull } from "../lib/customValueReaders";
import { wasLocalDraftTouched } from "../lib";
import { buildRoomFormulaRowValues, buildRoomsFormulaRegistry } from "../lib/roomsFormulaRegistry";
import { useRoomDialogController } from "../lib/useRoomDialogController";
import {
  PUMPS_TARGET_TABLE_PATH,
  type PumpRow,
  type PumpsSlice,
  type RoomRow,
  type RoomsSlice,
  VENTILATORS_TARGET_TABLE_PATH,
  type VentilatorRow,
  type VentilatorsSlice,
} from "../types";
import {
  SPACE_TYPE_NAME_FIELD_KEY,
  SPACE_TYPES_TARGET_TABLE_PATH,
  type SpaceTypeRow,
  type SpaceTypesSlice,
} from "../../spaces/types";
import { spaceTypesPath } from "../../spaces/paths";

export function RoomsPage({ project }: { project: ProjectDetail }) {
  const roomsQuery = useRoomsSliceQuery(project.id, project.active_version_id, project.access_mode);
  // Phase 1 record-linking: rooms can link to pumps via the
  // `linked_record` custom field type. We fetch the pumps slice
  // unconditionally so the linked-record pill resolver + picker
  // candidates have data. A still-loading or error'd pumps slice
  // degrades gracefully: pills fall back to row-id text and the picker
  // shows an empty candidate list. The fetch piggy-backs on the same
  // query cache the equipment page uses — no extra round-trip when the
  // user has just left the equipment page.
  const pumpsQuery = usePumpsSliceQuery(project.id, project.active_version_id, project.access_mode);
  const ventilatorsQuery = useVentilatorsSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const spaceTypesQuery = useSpaceTypesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  if (roomsQuery.isLoading) {
    return (
      <section className="tab-panel" aria-label="Rooms">
        <p>Loading rooms...</p>
      </section>
    );
  }
  if (roomsQuery.isError || !roomsQuery.data) {
    return <RoomsPageError project={project} error={roomsQuery.error} />;
  }
  return (
    <RoomsPageBody
      project={project}
      roomsSlice={roomsQuery.data}
      refetch={roomsQuery.refetch}
      pumpsSlice={pumpsQuery.data ?? null}
      ventilatorsSlice={ventilatorsQuery.data ?? null}
      spaceTypesSlice={spaceTypesQuery.data ?? null}
    />
  );
}

// Inner body guarantees a non-null `roomsSlice` so the slice-bound
// hooks don't need to short-circuit on every render.
function RoomsPageBody(props: {
  project: ProjectDetail;
  roomsSlice: RoomsSlice;
  refetch: () => Promise<unknown>;
  pumpsSlice: PumpsSlice | null;
  ventilatorsSlice: VentilatorsSlice | null;
  spaceTypesSlice: SpaceTypesSlice | null;
}) {
  const { project, roomsSlice, refetch, pumpsSlice, ventilatorsSlice, spaceTypesSlice } = props;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusRowId = searchParams.get("focus");
  const openModalRequested = searchParams.get("open") === "1";
  const activeVersionId = project.active_version_id;
  const isEditor = project.access_mode === "editor";

  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);
  const [roomPendingDelete, setRoomPendingDelete] = useState<RoomRow | null>(null);

  // Deep links (e.g. /projects/.../spaces/rooms?focus=<id>&open=1)
  // auto-open the row modal on landing. We then
  // drop the `open` param so subsequent modal closes don't re-open it.
  // `focus` is preserved for the existing scroll/highlight behaviour.
  useEffect(() => {
    if (!openModalRequested || !focusRowId) return;
    const room = roomsSlice.rooms.find((candidate) => candidate.id === focusRowId);
    if (!room) return;
    setRoomModal({ mode: "edit", room });
    setSearchParams(
      (params) => {
        params.delete("open");
        return params;
      },
      { replace: true },
    );
  }, [openModalRequested, focusRowId, roomsSlice.rooms, setSearchParams]);

  const activeRow = roomModal?.mode === "edit" ? roomModal.room : null;
  const { controller, buildEmptyRoomRow, saveRoom, deleteRoom, frozenReason } =
    useRoomDialogController({
      projectId: project.id,
      activeVersionId,
      accessMode: project.access_mode,
      versionLocked: project.active_version?.locked ?? false,
      roomsSlice,
      refetch,
      activeRoom: activeRow,
      onSaved: () => setRoomModal(null),
      onDeleted: () => {
        setRoomPendingDelete(null);
        setRoomModal(null);
      },
    });

  const formulaFieldRegistry = useMemo(
    () => buildRoomsFormulaRegistry(controller.tableSchema.fieldDefs),
    [controller.tableSchema.fieldDefs],
  );

  const linkedRecordOps: ReadonlyMap<string, LinkedRecordCellOps> | undefined = useMemo(() => {
    const maps: ReadonlyMap<string, LinkedRecordCellOps>[] = [];
    if (spaceTypesSlice?.space_types) {
      maps.push(
        buildLinkedRecordOps<SpaceTypeRow>({
          fieldDefs: controller.tableSchema.fieldDefs,
          targetTablePath: SPACE_TYPES_TARGET_TABLE_PATH,
          targetRows: spaceTypesSlice.space_types,
          getRowId: (spaceType) => spaceType.id,
          // Identity order: Display Name (`name`) is the primary pill
          // label and the picker's searchable text, then Tag
          // (`record_id`), then the raw row id (the buildLinkedRecordOps
          // fallback when both are null). The Tag rides along as the
          // muted secondary hint, shown only when a Display Name leads.
          getRecordId: (spaceType) =>
            customTextValueOrNull(spaceType, SPACE_TYPE_NAME_FIELD_KEY) ??
            customTextValueOrNull(spaceType, RECORD_ID_FIELD_KEY),
          getDisplayName: (spaceType) =>
            customTextValueOrNull(spaceType, SPACE_TYPE_NAME_FIELD_KEY)
              ? customTextValueOrNull(spaceType, RECORD_ID_FIELD_KEY)
              : null,
          onPillClick: (rowId) => {
            navigate({
              pathname: spaceTypesPath(project.id),
              search: `?focus=${encodeURIComponent(rowId)}`,
            });
          },
        }),
      );
    }
    if (pumpsSlice?.pumps) {
      maps.push(
        buildLinkedRecordOps<PumpRow>({
          fieldDefs: controller.tableSchema.fieldDefs,
          targetTablePath: PUMPS_TARGET_TABLE_PATH,
          targetRows: pumpsSlice.pumps,
          getRowId: (pump) => pump.id,
          // Same identity order as Space-Types: Display Name (`name`)
          // first, then Tag (`record_id`), then the raw row id.
          getRecordId: (pump) =>
            customTextValueOrNull(pump, "name") ?? customTextValueOrNull(pump, RECORD_ID_FIELD_KEY),
          onPillClick: (rowId) => {
            navigate(
              `/projects/${project.id}/equipment?tab=pumps&focus=${encodeURIComponent(rowId)}`,
            );
          },
        }),
      );
    }
    if (ventilatorsSlice?.ventilators) {
      maps.push(
        buildLinkedRecordOps<VentilatorRow>({
          fieldDefs: controller.tableSchema.fieldDefs,
          targetTablePath: VENTILATORS_TARGET_TABLE_PATH,
          targetRows: ventilatorsSlice.ventilators,
          getRowId: (ventilator) => ventilator.id,
          getRecordId: (ventilator) =>
            customTextValueOrNull(ventilator, "name") ??
            customTextValueOrNull(ventilator, RECORD_ID_FIELD_KEY),
          onPillClick: (rowId) => {
            navigate(
              `/projects/${project.id}/equipment?tab=ventilators&focus=${encodeURIComponent(rowId)}`,
            );
          },
        }),
      );
    }
    return mergeLinkedRecordOps(maps);
  }, [
    controller.tableSchema.fieldDefs,
    navigate,
    project.id,
    pumpsSlice,
    spaceTypesSlice,
    ventilatorsSlice,
  ]);

  const linkedRecordTargets = useMemo(
    () => linkedRecordTargetsFromFieldDefs(controller.tableSchema.fieldDefs),
    [controller.tableSchema.fieldDefs],
  );

  const reloadDraft = async () => {
    setRoomModal(null);
    await controller.reloadDraft();
  };

  return (
    <SliceTableShell
      ariaLabel="Rooms"
      className="tab-panel rooms-panel"
      showDraftRestoredBanner={
        roomsSlice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, roomsSlice.draft_etag)
      }
      draftRestoredMessage="Rooms draft restored"
      isLocked={controller.isLocked}
      lockedMessage="This version is locked. Save As to copy it into a new version."
      editBlocker={controller.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={controller.actionError}
    >
      <RoomsTableSlot
        controller={controller}
        roomsSlice={roomsSlice}
        projectId={project.id}
        activeVersionId={activeVersionId}
        buildEmptyRow={buildEmptyRoomRow}
        formulaFieldRegistry={formulaFieldRegistry}
        getFormulaRowValues={buildRoomFormulaRowValues}
        downloadAction={buildRoomsDownloadAction(project.id, activeVersionId)}
        footerAction={buildAddRoomFooterAction(controller.canEdit, () =>
          setRoomModal({ mode: "add" }),
        )}
        onEdit={(room) => setRoomModal({ mode: "edit", room })}
        linkedRecordOps={linkedRecordOps}
        linkedRecordTargets={linkedRecordTargets}
        focusRowId={focusRowId}
      />
      <RoomDialogStack
        isEditor={isEditor}
        roomsSlice={roomsSlice}
        roomModal={roomModal}
        roomPendingDelete={roomPendingDelete}
        frozenReason={frozenReason}
        blockerActive={Boolean(controller.editBlocker)}
        deletePending={controller.isReplacePending}
        onCancelModal={() => setRoomModal(null)}
        onSubmitRoom={saveRoom}
        onRequestDelete={(room) => setRoomPendingDelete(room)}
        onCancelDelete={() => setRoomPendingDelete(null)}
        onConfirmDelete={deleteRoom}
        onFrozenReload={() => void reloadDraft()}
      />
    </SliceTableShell>
  );
}

function mergeLinkedRecordOps(
  maps: ReadonlyArray<ReadonlyMap<string, LinkedRecordCellOps>>,
): ReadonlyMap<string, LinkedRecordCellOps> | undefined {
  if (maps.length === 0) return undefined;
  return new Map(maps.flatMap((map) => Array.from(map.entries())));
}

const LINKED_RECORD_TARGET_LABELS = new Map<string, string>([
  [targetPathKey(SPACE_TYPES_TARGET_TABLE_PATH), "Space-Types"],
  [targetPathKey(PUMPS_TARGET_TABLE_PATH), "Pumps"],
  [targetPathKey(VENTILATORS_TARGET_TABLE_PATH), "Ventilators"],
]);

function linkedRecordTargetsFromFieldDefs(
  fieldDefs: ReadonlyArray<FieldDef>,
): ReadonlyArray<LinkedRecordTargetTableOption> {
  const targets = new Map<string, LinkedRecordTargetTableOption>();
  for (const fieldDef of fieldDefs) {
    const path = fieldDef.linked_record_config?.target_table_path;
    if (!path) continue;
    const key = targetPathKey(path);
    targets.set(key, {
      path: [...path],
      label: LINKED_RECORD_TARGET_LABELS.get(key) ?? humanizeTargetPath(path),
    });
  }
  for (const [key, label] of LINKED_RECORD_TARGET_LABELS) {
    if (targets.has(key)) continue;
    targets.set(key, { path: key.split("/"), label });
  }
  return Array.from(targets.values());
}

function targetPathKey(path: ReadonlyArray<string>): string {
  return path.join("/");
}

function humanizeTargetPath(path: ReadonlyArray<string>): string {
  const last = path.at(-1) ?? "Records";
  return last
    .split("_")
    .map((word) => (word.length > 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
    .join(" ");
}
