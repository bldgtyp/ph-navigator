import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../../shared/lib/errors";
import { generatedId } from "../../../shared/lib/ids";
import { ModalDialog } from "../../../shared/ui/ModalDialog";
import {
  buildAddFieldMutation,
  buildDeleteFieldMutation,
  buildDuplicateFieldMutation,
  buildEditFieldBundleMutation,
  buildRenameFieldMutation,
  buildSetDescriptionMutation,
  buildSetFormulaMutation,
  clampNumberPrecision,
  emptyViewState,
  isCustomFieldKey,
  uniqueCopyDisplayName,
  useTableSchema,
} from "../../../shared/ui/data-table";
import { useProjectTableViewState } from "../../table_views/useProjectTableViewState";
import { projectDownloadUrl, tableDownloadUrl } from "../../project_document/api";
import { projectDocumentQueryKeys } from "../../project_document/hooks";
import type { ProjectDetail } from "../../projects/types";
import { projectQueryKeys } from "../../projects/query-keys";
import { RoomModal } from "../components/RoomModal";
import { RoomsTable } from "../components/RoomsTable";
import {
  useReplaceRoomsSliceMutation,
  useRoomsDraftBroadcast,
  useRoomsSchemaMutation,
  useRoomsSliceQuery,
} from "../hooks";
import {
  deleteRoomPayload,
  emptyRoom,
  firstRoomFloorOptionId,
  isDraftStaleError,
  isInvalidProjectDocumentError,
  isRoomOptionKey,
  isVersionLockedError,
  wasLocalDraftTouched,
  nextFreeRoomNumber,
  nextRoomsPayload,
  remoteSliceChangesActiveRoom,
  replaceRoomOptionsPayload,
  roomsPayloadFromCellWrites,
  roomsPayloadFromRowDelete,
  roomsPayloadFromRowInsert,
  ROOMS_SCHEMA_CORE_FIELD_KEYS,
  roomsTableColumnsForSanitize,
  roomsTableFieldDefs,
  validateRoomsPayload,
} from "../lib";
import type {
  AddCustomFieldRequest,
  BuildEmptyRow,
  EditCustomFieldBundleRequest,
  EditCustomFieldDescriptionRequest,
  EditCustomFieldFormulaRequest,
  FieldRegistryEntry,
  FieldSchemaMutation,
  RenameCustomFieldRequest,
  WriteOp,
} from "../../../shared/ui/data-table";
import {
  ROOM_BUILDING_ZONE_KEY,
  ROOM_FLOOR_LEVEL_KEY,
  ROOMS_TABLE_NAME,
  type RoomOptionKey,
  type RoomRow,
  type RoomsSlice,
} from "../types";

type RoomModalState = { mode: "add" } | { mode: "edit"; room: RoomRow };
type EditBlocker =
  | { kind: "draft-conflict"; message: string }
  | { kind: "version-locked"; message: string };

const ACTIVE_ROOM_CONFLICT_MESSAGE =
  "Rooms draft changed in another tab. Reload draft before saving this room.";
const DELETE_CONFLICT_MESSAGE =
  "Rooms draft changed in another tab. Reload draft before deleting rooms.";
const VERSION_LOCKED_MESSAGE =
  "This version was locked elsewhere. Local edits are preserved here; use Save As in the header or discard the draft.";

export function EquipmentTab({ project }: { project: ProjectDetail }) {
  const queryClient = useQueryClient();
  const roomsQuery = useRoomsSliceQuery(project.id, project.active_version_id, project.access_mode);
  const [roomModal, setRoomModal] = useState<RoomModalState | null>(null);
  const [roomPendingDelete, setRoomPendingDelete] = useState<RoomRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editBlocker, setEditBlocker] = useState<EditBlocker | null>(null);
  const isEditor = project.access_mode === "editor";
  const activeVersionId = project.active_version_id;
  const roomsViewDefaults = useMemo(() => emptyViewState(), []);
  const roomsCoreFieldDefs = useMemo(
    () => (roomsQuery.data ? roomsTableFieldDefs(roomsQuery.data) : []),
    [roomsQuery.data],
  );
  const roomsTableSchema = useTableSchema({
    tableKey: ROOMS_TABLE_NAME,
    coreFieldDefs: roomsCoreFieldDefs,
    fingerprintCoreFieldKeys: ROOMS_SCHEMA_CORE_FIELD_KEYS,
    customFields: roomsQuery.data?.custom_fields,
    singleSelectOptions: roomsQuery.data?.single_select_options ?? null,
  });
  // Sanitizer needs core + custom fields so view-state operations
  // (hide / resize / reorder / filter / sort / group) survive on
  // user-defined columns. Without custom fields here every cf_* entry
  // gets stripped, which silently reverts hide / column-width writes.
  const roomsColumnsForSanitize = useMemo(
    () => roomsTableColumnsForSanitize(roomsTableSchema.fieldDefs),
    [roomsTableSchema.fieldDefs],
  );
  // Core entries use the formula-side `field_id` (the Pydantic
  // attribute name), which differs from the column `field_key` for
  // namespaced single-selects ("rooms.floor_level" → "floor_level").
  const formulaFieldRegistry = useMemo<FieldRegistryEntry[]>(
    () => buildRoomsFormulaRegistry(roomsTableSchema.fieldDefs),
    [roomsTableSchema.fieldDefs],
  );
  const {
    view: roomsTableView,
    onViewChange: handleRoomsViewChange,
    isLoading: roomsViewLoading,
    reset: resetRoomsView,
  } = useProjectTableViewState({
    projectId: project.id,
    tableKey: ROOMS_TABLE_NAME,
    defaults: roomsViewDefaults,
    enabled: isEditor,
    columns: roomsColumnsForSanitize,
    fieldDefs: roomsTableSchema.fieldDefs,
    schemaFingerprint: roomsTableSchema.schemaFingerprint,
  });
  const isLocked =
    editBlocker?.kind === "version-locked" || (project.active_version?.locked ?? false);
  const canEdit = isEditor && !isLocked && !editBlocker && Boolean(activeVersionId);
  const onRemoteSlice = useCallback(
    (incomingSlice: RoomsSlice) => {
      if (!roomModal) {
        return;
      }
      if (
        roomModal.mode === "edit" &&
        roomsQuery.data &&
        remoteSliceChangesActiveRoom(roomsQuery.data, incomingSlice, roomModal.room)
      ) {
        setEditBlocker({ kind: "draft-conflict", message: ACTIVE_ROOM_CONFLICT_MESSAGE });
      }
    },
    [roomModal, roomsQuery.data],
  );
  const publishRoomsSlice = useRoomsDraftBroadcast(
    project.id,
    activeVersionId,
    isEditor,
    onRemoteSlice,
  );
  const replaceRoomsMutation = useReplaceRoomsSliceMutation(
    project.id,
    activeVersionId,
    publishRoomsSlice,
  );
  const schemaMutationMutation = useRoomsSchemaMutation(
    project.id,
    activeVersionId,
    publishRoomsSlice,
  );

  useEffect(() => {
    setEditBlocker(null);
  }, [activeVersionId]);

  const reloadDraft = async () => {
    setEditBlocker(null);
    setActionError(null);
    setRoomModal(null);
    await roomsQuery.refetch();
  };

  const handleStaleDraftConflict = async (message: string) => {
    setEditBlocker({ kind: "draft-conflict", message });
    await roomsQuery.refetch();
  };

  const handleVersionLockedConflict = async () => {
    setEditBlocker({ kind: "version-locked", message: VERSION_LOCKED_MESSAGE });
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(project.id) }),
    ];
    if (activeVersionId) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.draftSummary(project.id, activeVersionId),
        }),
      );
    }
    await Promise.all(invalidations);
  };

  if (roomsQuery.isLoading) {
    return (
      <section className="tab-panel" aria-label="Equipment">
        <p>Loading rooms...</p>
      </section>
    );
  }

  if (roomsQuery.isError || !roomsQuery.data) {
    const invalidDocument = isInvalidProjectDocumentError(roomsQuery.error);
    return (
      <section className="tab-panel" aria-label="Equipment">
        <p role="alert">{errorMessage(roomsQuery.error, "Could not load rooms.")}</p>
        {invalidDocument && activeVersionId ? (
          <p className="form-note">
            Editing is disabled for this version.{" "}
            <a href={projectDownloadUrl(project.id, activeVersionId)}>Download raw project JSON</a>
          </p>
        ) : null}
      </section>
    );
  }

  const roomsSlice = roomsQuery.data;
  const commitRoomsPayload = (
    payload: ReturnType<typeof nextRoomsPayload>,
    conflictMessage: string,
    fallbackMessage: string,
  ) => {
    const validationMessage = validateRoomsPayload(payload);
    if (validationMessage) {
      setActionError(validationMessage);
      throw new Error(validationMessage);
    }
    return withDraftConflictHandling(
      () => replaceRoomsMutation.mutateAsync({ current: roomsSlice, payload }),
      conflictMessage,
      fallbackMessage,
    );
  };

  const saveRoom = async (room: RoomRow, labels: { floorLevel: string; buildingZone: string }) => {
    await commitRoomsPayload(
      nextRoomsPayload(roomsSlice, room, labels),
      ACTIVE_ROOM_CONFLICT_MESSAGE,
      "Could not save room.",
    );
    setRoomModal(null);
  };

  const deleteRoom = (room: RoomRow) => {
    if (!canEdit) return;
    void commitRoomsPayload(
      deleteRoomPayload(roomsSlice, room.id),
      DELETE_CONFLICT_MESSAGE,
      "Could not delete room.",
    )
      .then(() => {
        setRoomPendingDelete(null);
        setRoomModal(null);
      })
      .catch(() => undefined);
  };

  const buildEmptyRoomRow: BuildEmptyRow<RoomRow> = ({ rowId, fieldDefaults, anchorRow }) => {
    if (anchorRow) {
      return {
        ...anchorRow,
        id: rowId,
        number: nextFreeRoomNumber(roomsSlice.rooms, anchorRow.number),
      };
    }
    // No-anchor fallback (currently unreachable via Shift+Enter
    // because the empty-state branch short-circuits the grid). Pulls
    // values from FieldDef.default through the library's
    // buildEmptyRowDefaults output.
    return {
      id: rowId,
      number: nextFreeRoomNumber(roomsSlice.rooms, String(fieldDefaults.number ?? "")),
      name: String(fieldDefaults.name ?? "Untitled"),
      floor_level: ((fieldDefaults[ROOM_FLOOR_LEVEL_KEY] as string | null | undefined) ??
        firstRoomFloorOptionId(roomsSlice)) as string | null,
      building_zone: (fieldDefaults[ROOM_BUILDING_ZONE_KEY] as string | null | undefined) ?? null,
      num_people: Number(fieldDefaults.num_people ?? 0),
      num_bedrooms: Number(fieldDefaults.num_bedrooms ?? 0),
      icfa_factor: Number(fieldDefaults.icfa_factor ?? 1),
      erv_unit_ids: [],
      catalog_origin: null,
      notes: null,
      custom: {},
    };
  };

  const handleTableWrite = async (op: WriteOp) => {
    if (!canEdit) return;
    if (op.kind === "cell" || op.kind === "paste" || op.kind === "fill") {
      // Phase 7: `fill` shares the CellWrite[] payload shape with
      // `cell` / `paste` but carries no option list delta (the source
      // values are already in the table — fill never creates options).
      const newOptions =
        op.kind === "paste" ? op.newOptions : op.kind === "cell" ? (op.newOptions ?? {}) : {};
      const removedOptions = op.kind === "fill" ? {} : (op.removedOptions ?? {});
      await commitRoomsPayload(
        roomsPayloadFromCellWrites(roomsSlice, op.writes, newOptions, removedOptions),
        ACTIVE_ROOM_CONFLICT_MESSAGE,
        "Could not update rooms table values.",
      );
      return;
    }
    if (op.kind === "rowInsert") {
      await commitRoomsPayload(
        roomsPayloadFromRowInsert(roomsSlice, op.rows, buildEmptyRoomRow),
        ACTIVE_ROOM_CONFLICT_MESSAGE,
        "Could not insert room.",
      );
      return;
    }
    if (op.kind === "rowDelete") {
      await commitRoomsPayload(
        roomsPayloadFromRowDelete(roomsSlice, op.rows),
        ACTIVE_ROOM_CONFLICT_MESSAGE,
        "Could not delete rooms.",
      );
      return;
    }
    if (op.kind === "schemaMutation") {
      if (op.variant === "typed") {
        await commitSchemaMutation(op.mutation);
        return;
      }
      // Single-select option editor — Phase 2 still rides through the
      // whole-table replace path; plan-16 splits it into its own kind.
      const { after } = op;
      if (!isRoomOptionKey(after.field_key)) return;
      const optionKey = after.field_key;
      const replacements = collapseRoomCellWritesToReplacements(
        roomsSlice,
        optionKey,
        op.cellWrites,
      );
      let payload: ReturnType<typeof replaceRoomOptionsPayload>;
      try {
        payload = replaceRoomOptionsPayload(
          roomsSlice,
          optionKey,
          after.options ?? [],
          replacements,
        );
      } catch (error) {
        const message = errorMessage(error, "Could not update room options.");
        setActionError(message);
        throw new Error(message);
      }
      await commitRoomsPayload(
        payload,
        ACTIVE_ROOM_CONFLICT_MESSAGE,
        "Could not update room options.",
      );
      return;
    }
  };

  const commitSchemaMutation = (mutation: FieldSchemaMutation) =>
    withDraftConflictHandling(
      () => schemaMutationMutation.mutateAsync({ current: roomsSlice, mutation }),
      ACTIVE_ROOM_CONFLICT_MESSAGE,
      "Could not update custom-field schema.",
    );

  const handleDeleteCustomField = async (fieldKey: string) => {
    if (!canEdit) return;
    const mutation = buildDeleteFieldMutation({
      tableKey: ROOMS_TABLE_NAME,
      fieldId: fieldKey,
      schemaFingerprint: roomsTableSchema.schemaFingerprint,
    });
    await commitSchemaMutation(mutation);
  };

  const handleRenameCustomField = async (request: RenameCustomFieldRequest) => {
    if (!canEdit) return;
    const mutation = buildRenameFieldMutation({
      tableKey: ROOMS_TABLE_NAME,
      fieldId: request.fieldKey,
      displayName: request.displayName,
      schemaFingerprint: roomsTableSchema.schemaFingerprint,
    });
    await commitSchemaMutation(mutation);
  };

  const handleDuplicateCustomField = async (fieldKey: string): Promise<{ newFieldKey: string }> => {
    if (!canEdit) {
      throw new Error("Cannot duplicate a field while editing is disabled.");
    }
    const source = roomsSlice.custom_fields.find((field) => field.id === fieldKey);
    if (!source) {
      throw new Error("That custom field no longer exists. Refresh to see the current fields.");
    }
    const newFieldId = roomsTableSchema.mintCustomFieldId();
    const mutation = buildDuplicateFieldMutation({
      tableKey: ROOMS_TABLE_NAME,
      sourceFieldId: fieldKey,
      newField: {
        id: newFieldId,
        field_key: null,
        display_name: uniqueCopyDisplayName(
          source.display_name,
          roomsTableSchema.fieldDefs.map((fieldDef) => fieldDef.display_name),
        ),
        field_type: source.field_type,
        config: structuredClone(source.config),
        description: source.description,
        created_at: new Date().toISOString(),
        created_by: null,
      },
      schemaFingerprint: roomsTableSchema.schemaFingerprint,
    });
    await commitSchemaMutation(mutation);
    const nextOrder = insertAfterColumnOrder(roomsTableView.columnOrder, fieldKey, newFieldId);
    if (nextOrder) {
      handleRoomsViewChange({ ...roomsTableView, columnOrder: nextOrder });
    }
    return { newFieldKey: newFieldId };
  };

  const handleSetCustomFieldDescription = async (request: EditCustomFieldDescriptionRequest) => {
    if (!canEdit) return;
    const mutation = buildSetDescriptionMutation({
      tableKey: ROOMS_TABLE_NAME,
      fieldId: request.fieldKey,
      description: request.description,
      schemaFingerprint: roomsTableSchema.schemaFingerprint,
    });
    await commitSchemaMutation(mutation);
  };

  // plan-21 P5a.1 — unified field-config modal Save handler. Looks up
  // the source CustomFieldDef and builds an `editFieldBundle` mutation
  // carrying the user's display_name + description diff. Later
  // sub-phases extend `request` (type-change / options / formula) and
  // this builder picks them up without churning the rest of the wiring.
  const handleEditCustomFieldBundle = async (request: EditCustomFieldBundleRequest) => {
    if (!canEdit) return;
    const source = roomsSlice.custom_fields.find((field) => field.id === request.fieldKey);
    if (!source) {
      throw new Error("That custom field no longer exists. Refresh to see the current fields.");
    }
    const nextFieldType = request.fieldType ?? source.field_type;
    const typeChanged = nextFieldType !== source.field_type;
    let nextConfig: Record<string, unknown> = typeChanged ? {} : structuredClone(source.config);
    if (nextFieldType !== "single_select") {
      delete nextConfig.default_option_id;
      delete nextConfig.color_code_options;
    } else {
      nextConfig = {
        ...nextConfig,
        default_option_id: request.defaultOptionId ?? null,
        color_code_options: request.colorCodeOptions ?? true,
      };
    }
    if (nextFieldType === "number" && (request.numberPrecision !== undefined || typeChanged)) {
      nextConfig.precision = clampNumberPrecision(request.numberPrecision);
    } else if (nextFieldType !== "number") {
      delete nextConfig.precision;
    }
    if (nextFieldType !== "formula") {
      delete nextConfig.source;
      delete nextConfig.ast;
      delete nextConfig.deps;
      delete nextConfig.result_type;
    } else if (request.formulaSource !== undefined) {
      nextConfig.source = request.formulaSource;
    }
    const mutation = buildEditFieldBundleMutation({
      tableKey: ROOMS_TABLE_NAME,
      fieldId: request.fieldKey,
      after: {
        ...source,
        display_name: request.displayName,
        description: request.description,
        field_type: nextFieldType,
        config: nextConfig,
      },
      nextOptions: request.options,
      acknowledgeDestructive: request.acknowledgeDestructive ?? false,
      formulaSource: request.formulaSource,
      schemaFingerprint: roomsTableSchema.schemaFingerprint,
    });
    await commitSchemaMutation(mutation);
  };

  const handleEditCustomFieldFormula = async (request: EditCustomFieldFormulaRequest) => {
    if (!canEdit) return;
    const mutation = buildSetFormulaMutation({
      tableKey: ROOMS_TABLE_NAME,
      fieldId: request.fieldKey,
      source: request.source,
      schemaFingerprint: roomsTableSchema.schemaFingerprint,
    });
    await commitSchemaMutation(mutation);
  };

  const handleAddCustomField = async (
    request: AddCustomFieldRequest,
  ): Promise<{ newFieldKey: string }> => {
    if (!canEdit) {
      throw new Error("Cannot add a field while editing is disabled.");
    }
    const newFieldId = roomsTableSchema.mintCustomFieldId();
    // The backend's `insert_after_field_id` only references existing
    // custom fields. When the visual anchor is a core column, forward
    // null so the new field appends to `custom_fields`; the
    // columnOrder splice below still places it in the visible slot
    // the user asked for.
    const backendAnchor =
      request.insertAfterFieldKey && isCustomFieldKey(request.insertAfterFieldKey)
        ? request.insertAfterFieldKey
        : null;
    const mutation = buildAddFieldMutation({
      tableKey: ROOMS_TABLE_NAME,
      newField: {
        id: newFieldId,
        field_key: null,
        display_name: request.displayName,
        field_type: request.fieldType,
        config: request.config,
        description: request.description,
        created_at: new Date().toISOString(),
        created_by: null,
      },
      insertAfterFieldId: backendAnchor,
      initialOptions: request.initialOptions,
      schemaFingerprint: roomsTableSchema.schemaFingerprint,
    });
    await commitSchemaMutation(mutation);
    // On a fresh project `columnOrder` is `[]` and the grid renders in
    // schema order — splicing into an empty list would write `[newId]`,
    // which freezes the order. Only sync when the user has already
    // reordered (list non-empty) AND the anchor is in that list.
    if (request.insertAfterFieldKey) {
      const nextOrder = insertAfterColumnOrder(
        roomsTableView.columnOrder,
        request.insertAfterFieldKey,
        newFieldId,
      );
      if (nextOrder) {
        handleRoomsViewChange({ ...roomsTableView, columnOrder: nextOrder });
      }
    }
    return { newFieldKey: newFieldId };
  };

  const withDraftConflictHandling = async <T,>(
    run: () => Promise<T>,
    conflictMessage: string,
    fallbackMessage: string,
  ): Promise<T | undefined> => {
    if (!canEdit) return undefined;
    setActionError(null);
    try {
      return await run();
    } catch (error) {
      if (isDraftStaleError(error)) {
        await handleStaleDraftConflict(conflictMessage);
        throw error;
      }
      if (isVersionLockedError(error)) {
        await handleVersionLockedConflict();
        throw error;
      }
      const message = errorMessage(error, fallbackMessage);
      setActionError(message);
      throw new Error(message);
    }
  };

  const roomsDownloadAction = activeVersionId ? (
    <a
      className="data-table-overflow-menu-item"
      href={tableDownloadUrl(project.id, activeVersionId, ROOMS_TABLE_NAME)}
    >
      Rooms JSON
    </a>
  ) : null;
  const addRoomAction = canEdit ? (
    <button
      type="button"
      className="data-table-add-row-button"
      aria-label="Add New Room"
      title="Add New Room"
      onClick={() => setRoomModal({ mode: "add" })}
    >
      +
    </button>
  ) : null;

  return (
    <section className="tab-panel equipment-panel" aria-label="Equipment">
      <div className="subtabbar" aria-label="Equipment tables">
        <button type="button" className="active">
          Rooms
        </button>
        <button type="button" disabled>
          Thermal Bridges
        </button>
        <button type="button" disabled>
          ERVs
        </button>
        <button type="button" disabled>
          Pumps
        </button>
        <button type="button" disabled>
          Fans
        </button>
      </div>
      {roomsSlice.source === "draft" &&
      activeVersionId &&
      !wasLocalDraftTouched(project.id, activeVersionId, roomsSlice.draft_etag) ? (
        <p className="draft-banner">Unsaved Rooms draft restored</p>
      ) : null}
      {isLocked ? (
        <p className="draft-banner">
          This version is locked. Save As to copy it into a new version.
        </p>
      ) : null}
      {editBlocker ? (
        <div className="draft-banner draft-conflict-banner" role="alert">
          <span>{editBlocker.message}</span>
          {editBlocker.kind === "draft-conflict" ? (
            <button type="button" className="secondary-button" onClick={() => void reloadDraft()}>
              Reload draft
            </button>
          ) : null}
        </div>
      ) : null}
      {actionError ? (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      ) : null}
      {roomsViewLoading ? (
        <p className="form-note">Loading table view…</p>
      ) : (
        <RoomsTable
          roomsSlice={roomsSlice}
          tableSchema={roomsTableSchema}
          isEditor={canEdit}
          onEdit={(room) => setRoomModal({ mode: "edit", room })}
          view={roomsTableView}
          onViewChange={handleRoomsViewChange}
          onResetView={resetRoomsView}
          onWrite={handleTableWrite}
          buildEmptyRow={canEdit ? buildEmptyRoomRow : undefined}
          generateRowId={canEdit ? () => generatedId("rm") : undefined}
          sessionKey={`${project.id}:${activeVersionId ?? "none"}:${ROOMS_TABLE_NAME}`}
          overflowMenuActions={roomsDownloadAction}
          footerAction={addRoomAction}
          onDeleteCustomField={canEdit ? handleDeleteCustomField : undefined}
          onAddCustomField={canEdit ? handleAddCustomField : undefined}
          onRenameCustomField={canEdit ? handleRenameCustomField : undefined}
          onDuplicateCustomField={canEdit ? handleDuplicateCustomField : undefined}
          onSetCustomFieldDescription={canEdit ? handleSetCustomFieldDescription : undefined}
          onEditCustomFieldBundle={canEdit ? handleEditCustomFieldBundle : undefined}
          onEditCustomFieldFormula={canEdit ? handleEditCustomFieldFormula : undefined}
          formulaFieldRegistry={formulaFieldRegistry}
          getFormulaRowValues={buildRoomFormulaRowValues}
          rowsComputed={roomsSlice.rows_computed}
        />
      )}
      {roomModal && isEditor ? (
        <RoomModal
          key={roomModal.mode === "add" ? "add" : roomModal.room.id}
          title={
            roomModal.mode === "add"
              ? "New room"
              : `Room: ${roomModal.room.number} - ${roomModal.room.name}`
          }
          room={
            roomModal.mode === "add"
              ? emptyRoom(firstRoomFloorOptionId(roomsSlice))
              : roomModal.room
          }
          roomsSlice={roomsSlice}
          onCancel={() => setRoomModal(null)}
          onSubmit={saveRoom}
          frozenReason={editBlocker?.message ?? (isLocked ? VERSION_LOCKED_MESSAGE : null)}
          onFrozenReload={() => void reloadDraft()}
          onDelete={
            roomModal.mode === "edit" ? () => setRoomPendingDelete(roomModal.room) : undefined
          }
          deleteDisabled={Boolean(editBlocker)}
        />
      ) : null}
      {roomPendingDelete ? (
        <ModalDialog
          title={`Delete room ${roomPendingDelete.number}?`}
          titleId="delete-room-title"
          onClose={() => setRoomPendingDelete(null)}
        >
          <p>This removes the room from the active draft.</p>
          <div className="modal-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRoomPendingDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => deleteRoom(roomPendingDelete)}
              disabled={replaceRoomsMutation.isPending}
            >
              Delete room
            </button>
          </div>
        </ModalDialog>
      ) : null}
    </section>
  );
}

function collapseRoomCellWritesToReplacements(
  slice: RoomsSlice,
  key: RoomOptionKey,
  cellWrites: ReadonlyArray<{ rowId: string; fieldKey: string; value: unknown }> | undefined,
): Record<string, string | null> {
  if (!cellWrites?.length) return {};
  const roomField = key === ROOM_FLOOR_LEVEL_KEY ? "floor_level" : "building_zone";
  const replacements: Record<string, string | null> = {};
  for (const write of cellWrites) {
    if (write.fieldKey !== key) continue;
    const room = slice.rooms.find((candidate) => candidate.id === write.rowId);
    const previousOptionId = room?.[roomField] ?? null;
    if (previousOptionId) {
      replacements[previousOptionId] = typeof write.value === "string" ? write.value : null;
    }
  }
  return replacements;
}

// Maps Rooms FieldDefs (whose `field_key`s use the column-side
// namespaced ids for `rooms.floor_level` / `rooms.building_zone`) onto
// formula-side `field_id`s that match the backend's
// `ROOMS_CORE_FORMULA_TYPES` keys. Custom fields already use the
// formula identity (their `cf_*` id), so the mapping is identity for
// them.
const ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY: Record<string, string> = {
  [ROOM_FLOOR_LEVEL_KEY]: "floor_level",
  [ROOM_BUILDING_ZONE_KEY]: "building_zone",
};

function buildRoomsFormulaRegistry(
  fieldDefs: ReadonlyArray<{
    field_key: string;
    display_name: string;
    field_type: string;
    read_only_schema?: boolean;
  }>,
): FieldRegistryEntry[] {
  return fieldDefs.map((fieldDef) => {
    const isCore = fieldDef.read_only_schema === true;
    const fieldId = ROOMS_FORMULA_FIELD_ID_BY_COLUMN_KEY[fieldDef.field_key] ?? fieldDef.field_key;
    const formulaType = mapToFormulaType(fieldDef.field_type);
    return {
      field_id: fieldId,
      display_name: fieldDef.display_name,
      origin: isCore ? "core" : "custom",
      field_type: formulaType,
    };
  });
}

function mapToFormulaType(
  fieldType: string,
): "text" | "number" | "single_select" | "formula" | "bool" {
  switch (fieldType) {
    case "number":
      return "number";
    case "single_select":
      return "single_select";
    case "computed":
      return "formula";
    default:
      return "text";
  }
}

// Read a formula-side core value off a RoomRow, mirroring the
// backend's `_read_rooms_core_field_for_formula` so the in-editor live
// preview agrees with the server-side computed overlay. List-valued
// cores are joined with ", " for parity.
function readRoomsFormulaValue(room: RoomRow, fieldId: string): unknown {
  if (fieldId.startsWith("cf_")) {
    return room.custom[fieldId] ?? null;
  }
  const raw = (room as unknown as Record<string, unknown>)[fieldId];
  if (Array.isArray(raw)) return raw.map((v) => String(v)).join(", ");
  if (raw === undefined) return null;
  return raw;
}

function buildRoomFormulaRowValues(room: RoomRow): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const fieldId of ROOMS_SCHEMA_CORE_FIELD_KEYS) {
    values[fieldId] = readRoomsFormulaValue(room, fieldId);
  }
  for (const [cfId, value] of Object.entries(room.custom)) {
    values[cfId] = value ?? null;
  }
  return values;
}

function insertAfterColumnOrder(
  columnOrder: ReadonlyArray<string>,
  anchorFieldKey: string,
  insertedFieldKey: string,
): string[] | null {
  if (columnOrder.length === 0) return null;
  const filtered = columnOrder.filter((id) => id !== insertedFieldKey);
  const anchorIndex = filtered.indexOf(anchorFieldKey);
  if (anchorIndex < 0) return null;
  return [
    ...filtered.slice(0, anchorIndex + 1),
    insertedFieldKey,
    ...filtered.slice(anchorIndex + 1),
  ];
}
