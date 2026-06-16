import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { generatedId } from "../../../shared/lib/ids";
import { RECORD_ID_FIELD_KEY } from "../../../shared/ui/data-table";
import { SliceTableShell, useSliceTableController } from "../../../shared/ui/data-table/feature";
import { customTextValueOrNull } from "../../equipment/lib/customValueReaders";
import { wasLocalDraftTouched } from "../../equipment/lib";
import { useRoomsSliceQuery } from "../../equipment/hooks";
import type { RoomRow, RoomsSlice } from "../../equipment/types";
import type { ProjectDetail } from "../../projects/types";
import { SpaceTypesTableSlot } from "../components/SpaceTypesTableSlot";
import { buildEmptySpaceTypeRow } from "../lib/buildEmptySpaceTypeRow";
import { spaceTypeColumnStubs, spaceTypesPayloadBuilders } from "../lib/spaceTypesController";
import {
  useReplaceSpaceTypesSliceMutation,
  useSpaceTypesSchemaMutation,
  useSpaceTypesSliceQuery,
} from "../hooks";
import { spacesRoomsPath } from "../paths";
import {
  SPACE_TYPE_ID_PREFIX,
  SPACE_TYPES_TABLE_NAME,
  type InverseLinkField,
  type SpaceTypesSlice,
} from "../types";
import type { LinkedRoomResolver } from "../components/SpaceTypesTable";

export function SpaceTypesPage({ project }: { project: ProjectDetail }) {
  const spaceTypesQuery = useSpaceTypesSliceQuery(
    project.id,
    project.active_version_id,
    project.access_mode,
  );
  const roomsQuery = useRoomsSliceQuery(project.id, project.active_version_id, project.access_mode);

  if (spaceTypesQuery.isLoading) {
    return (
      <section className="tab-panel" aria-label="Space-Types">
        <p>Loading Space-Types...</p>
      </section>
    );
  }
  if (spaceTypesQuery.isError || !spaceTypesQuery.data) {
    return (
      <section className="tab-panel" aria-label="Space-Types">
        <p className="form-error" role="alert">
          Could not load Space-Types.
        </p>
      </section>
    );
  }

  return (
    <SpaceTypesPageBody
      project={project}
      spaceTypesSlice={spaceTypesQuery.data}
      roomsSlice={roomsQuery.data ?? null}
      refetch={spaceTypesQuery.refetch}
    />
  );
}

function SpaceTypesPageBody({
  project,
  spaceTypesSlice,
  roomsSlice,
  refetch,
}: {
  project: ProjectDetail;
  spaceTypesSlice: SpaceTypesSlice;
  roomsSlice: RoomsSlice | null;
  refetch: () => Promise<unknown>;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeVersionId = project.active_version_id;
  const replaceMutation = useReplaceSpaceTypesSliceMutation(project.id, activeVersionId);
  const schemaMutation = useSpaceTypesSchemaMutation(project.id, activeVersionId);

  const controller = useSliceTableController({
    projectId: project.id,
    activeVersionId,
    accessMode: project.access_mode,
    versionLocked: project.active_version?.locked ?? false,
    tableKey: SPACE_TYPES_TABLE_NAME,
    slice: spaceTypesSlice,
    fieldDefs: spaceTypesSlice.field_defs,
    singleSelectOptions: spaceTypesSlice.single_select_options,
    columnsForSanitize: spaceTypeColumnStubs(
      spaceTypesSlice.field_defs,
      spaceTypesSlice.inverse_link_fields,
    ),
    payloadBuilders: spaceTypesPayloadBuilders,
    conflictMessages: {
      activeRowConflict:
        "This Space-Types draft changed in another tab. Reload the draft before editing.",
      deleteConflict: "Could not delete Space-Type.",
      versionLocked: "This version is locked. Save As to copy it into a new version.",
    },
    buildEmptyRow: buildEmptySpaceTypeRow,
    activeRow: null,
    replaceMutation,
    schemaMutation,
    refetch,
  });

  const resolveLinkedRoom = useMemo<LinkedRoomResolver>(() => {
    const rowsComputed = roomsSlice?.rows_computed ?? {};
    const labelsById = new Map(
      (roomsSlice?.rooms ?? []).map((room) => [room.id, roomLabel(room, rowsComputed[room.id])]),
    );
    return (rowId) => {
      const label = labelsById.get(rowId);
      return label === undefined ? null : { recordId: label };
    };
  }, [roomsSlice]);

  const onInversePillClick = (field: InverseLinkField, rowId: string) => {
    if (field.source_table_path[0] !== "rooms") return;
    const next = new URLSearchParams(searchParams);
    next.set("focus", rowId);
    next.set("open", "1");
    navigate({
      pathname: spacesRoomsPath(project.id),
      search: next.toString() ? `?${next.toString()}` : "",
    });
  };

  const reloadDraft = async () => {
    await controller.reloadDraft();
  };

  return (
    <SliceTableShell
      ariaLabel="Space-Types"
      className="tab-panel spaces-panel"
      showDraftRestoredBanner={
        spaceTypesSlice.source === "draft" &&
        Boolean(activeVersionId) &&
        !wasLocalDraftTouched(project.id, activeVersionId!, spaceTypesSlice.draft_etag)
      }
      draftRestoredMessage="Space-Types draft restored"
      isLocked={controller.isLocked}
      lockedMessage="This version is locked. Save As to copy it into a new version."
      editBlocker={controller.editBlocker}
      onReloadDraft={() => void reloadDraft()}
      actionError={controller.actionError}
    >
      <SpaceTypesTableSlot
        controller={controller}
        spaceTypesSlice={spaceTypesSlice}
        projectId={project.id}
        activeVersionId={activeVersionId}
        buildEmptyRow={buildEmptySpaceTypeRow}
        footerAction={addSpaceTypeButton(controller.canEdit, () => insertSpaceTypeRow(controller))}
        focusRowId={searchParams.get("focus")}
        resolveLinkedRoom={resolveLinkedRoom}
        onInversePillClick={onInversePillClick}
      />
    </SliceTableShell>
  );
}

function addSpaceTypeButton(canEdit: boolean, onAdd: () => void) {
  if (!canEdit) return null;
  return (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label="Add Space-Type"
      title="Add Space-Type"
      onClick={onAdd}
    >
      +
    </button>
  );
}

function insertSpaceTypeRow(controller: { onWrite: SpaceTypesSliceControllerWrite }) {
  void controller.onWrite({
    kind: "rowInsert",
    rows: [
      {
        rowId: generatedId(SPACE_TYPE_ID_PREFIX),
        fieldDefaults: {},
        anchorRowId: null,
      },
    ],
  });
}

type SpaceTypesSliceControllerWrite = (op: {
  kind: "rowInsert";
  rows: { rowId: string; fieldDefaults: Record<string, unknown>; anchorRowId: null }[];
}) => unknown;

function roomLabel(room: RoomRow, computed: Record<string, unknown> | undefined): string {
  const computedRecordId = computed?.[RECORD_ID_FIELD_KEY];
  if (typeof computedRecordId === "string" && computedRecordId.trim().length > 0) {
    return computedRecordId;
  }
  const number = customTextValueOrNull(room, "number");
  const name = customTextValueOrNull(room, "name");
  if (number && name) return `${number} - ${name}`;
  return number ?? name ?? room.id;
}
