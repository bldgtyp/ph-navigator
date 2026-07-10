// Generic orchestrator for the "slice-backed DataTable" pattern. Every
// feature tab that ships a JSON-document slice + DataTable composes
// this hook with its own SlicePayloadBuilders, then renders the
// returned controller through <SliceTableShell> + its own table.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { errorMessage } from "../../../lib/errors";
import { useTableSchema } from "../index";
import { isDraftStaleError, isVersionLockedError } from "../../../../features/project_document/lib";
import {
  WriteQueueCancelledError,
  WriteQueueDrainedError,
  type TransportTask,
} from "../../../../features/project_document/draftWriteCoordinator";
import { useDraftWriteCoordinator } from "../../../../features/project_document/useDraftWriteCoordinator";
import {
  projectDocumentQueryKeys,
  projectDocumentTableQueryKeys,
} from "../../../../features/project_document/query-keys";
import { projectQueryKeys } from "../../../../features/projects/query-keys";
import { useProjectTableViewState } from "../../../../features/table_views/hooks";
import {
  refetchResultData,
  resolveCachedSliceForWrite,
  type TableReplaceMutationVariables,
  type TableSliceAccessMode,
} from "../../../../features/project_document/table-slice";
import type { BuildEmptyRow, FieldOption, WriteOp } from "../types";
import { useJournaledSliceCommit } from "./useJournaledSliceCommit";
import { buildCoalescedTablePayload } from "./buildCoalescedTablePayload";
import type { FieldRegistryEntry, TableFieldDef, TableFieldRenderOverlays } from "../index";
import type { FieldSchemaMutation } from "../lib/customFieldMutations";
import { useCustomFieldHandlers } from "./useCustomFieldHandlers";
import type {
  ConflictMessages,
  EditBlocker,
  SlicePayloadBuilders,
  SliceTableController,
} from "./types";
import { composePastePayload } from "./types";
import { emptyViewState } from "../types";

export type SliceTableReplaceMutation<TSlice, TPayload> = UseMutationResult<
  TSlice,
  Error,
  TableReplaceMutationVariables<TSlice, TPayload>
>;

export type SliceTableSchemaMutation<TSlice> = UseMutationResult<
  TSlice,
  Error,
  { current: TSlice; mutation: FieldSchemaMutation }
>;

export type UseSliceTableControllerArgs<TSlice, TRow extends { id: string }, TPayload> = {
  projectId: string;
  activeVersionId: string | null;
  accessMode: TableSliceAccessMode;
  versionLocked: boolean;
  tableKey: string;
  // The latest accepted slice. The controller assumes the consumer has
  // already short-circuited on loading / error so this is non-null.
  slice: TSlice;
  fieldDefs: TableFieldDef[] | null | undefined;
  fieldOverlay?: TableFieldRenderOverlays | null;
  singleSelectOptions: Record<string, FieldOption[]> | null;
  // Stub columns whose `id` / `fieldKey` mirror the live grid's. The
  // view-state sanitizer reads only `id` + `fieldKey`, so a slim list
  // is fine. (See lib/view/sanitize.ts.)
  columnsForSanitize: Parameters<typeof useProjectTableViewState>[0]["columns"];
  payloadBuilders: SlicePayloadBuilders<TSlice, TRow, TPayload>;
  conflictMessages: ConflictMessages;
  buildEmptyRow: BuildEmptyRow<TRow>;
  // The active "focused" row (e.g. the row open in a detail modal).
  // Pass null when the tab has no active-row concept.
  activeRow: TRow | null;
  replaceMutation: SliceTableReplaceMutation<TSlice, TPayload>;
  schemaMutation: SliceTableSchemaMutation<TSlice>;
  // Returns a fresh slice from the network. Used by reload-draft and
  // by the stale-draft conflict path. TanStack Query's observer refetch
  // returns `{ data }`; the broader return type keeps modal/test callers
  // with custom fetch shims compatible.
  refetch: () => Promise<unknown>;
  // Column ids hidden on first load. Applied only when the user has no
  // saved view state for this table; subsequent toggles persist as
  // usual. NB: the downstream `useState(defaults)` inside
  // `useProjectTableViewState` captures the value on mount, so changing
  // this prop dynamically (e.g. from an async feature flag) only takes
  // effect on Reset — pass a stable module-constant unless that
  // semantics is intended.
  defaultHiddenColumns?: string[];
  // Modal-only consumers can opt out of table-view persistence while
  // still reusing schema, mutation, and conflict handling.
  viewStateEnabled?: boolean;
};

export function useSliceTableController<TSlice, TRow extends { id: string }, TPayload>(
  args: UseSliceTableControllerArgs<TSlice, TRow, TPayload>,
): SliceTableController<TSlice> {
  const queryClient = useQueryClient();
  const {
    projectId,
    activeVersionId,
    accessMode,
    versionLocked,
    tableKey,
    slice,
    fieldDefs,
    fieldOverlay,
    singleSelectOptions,
    columnsForSanitize,
    payloadBuilders,
    conflictMessages,
    buildEmptyRow,
    activeRow,
    replaceMutation,
    schemaMutation,
    refetch,
    defaultHiddenColumns,
    viewStateEnabled = true,
  } = args;

  const isEditor = accessMode === "editor";
  const [actionError, setActionError] = useState<string | null>(null);
  const [editBlocker, setEditBlocker] = useState<EditBlocker | null>(null);
  const { coordinator: writeCoordinator, status: writeStatus } = useDraftWriteCoordinator(
    projectId,
    activeVersionId,
  );

  // Stringify-keyed memoization keeps `viewDefaults` identity stable
  // when the caller passes an inline `["…"]` literal. `useProjectTableViewState`
  // treats `defaults` as stable identity, so we cannot key on the array
  // reference directly.
  const defaultHiddenColumnsKey = JSON.stringify(defaultHiddenColumns ?? []);
  const viewDefaults = useMemo(() => {
    const hidden = JSON.parse(defaultHiddenColumnsKey) as string[];
    return hidden.length > 0 ? { ...emptyViewState(), hiddenColumns: hidden } : emptyViewState();
  }, [defaultHiddenColumnsKey]);
  const tableSchema = useTableSchema({
    tableKey,
    fieldDefs,
    fieldOverlay,
    singleSelectOptions,
  });

  const {
    view,
    onViewChange,
    isLoading: viewLoading,
    reset: onResetView,
  } = useProjectTableViewState({
    projectId,
    tableKey,
    defaults: viewDefaults,
    enabled: isEditor && viewStateEnabled,
    columns: viewStateEnabled ? columnsForSanitize : [],
    fieldDefs: viewStateEnabled ? tableSchema.fieldDefs : [],
    schemaFingerprint: tableSchema.schemaFingerprint,
  });

  const isLocked = editBlocker?.kind === "version-locked" || versionLocked;
  const canEdit = isEditor && !isLocked && !editBlocker && Boolean(activeVersionId);
  const editorSliceQueryKey = useMemo(
    () =>
      activeVersionId
        ? ([
            ...projectDocumentTableQueryKeys.table(projectId, tableKey),
            "slice",
            activeVersionId,
            "editor",
          ] as const)
        : null,
    [activeVersionId, projectId, tableKey],
  );

  useEffect(() => {
    setEditBlocker(null);
  }, [activeVersionId]);

  // Consumer hooks this into its broadcast subscription (e.g.
  // `useRoomsDraftBroadcast`). Only fires the active-row conflict
  // banner when the tab has an active row AND the payload builders
  // define `remoteSliceChangesActiveRow`; tabs without a modal can
  // pass `activeRow={null}` and the gate skips the comparison.
  const notifyRemoteSlice = useCallback(
    (incoming: TSlice) => {
      if (!activeRow) return;
      if (!payloadBuilders.remoteSliceChangesActiveRow) return;
      if (payloadBuilders.remoteSliceChangesActiveRow(slice, incoming, activeRow)) {
        setEditBlocker({
          kind: "draft-conflict",
          message: conflictMessages.activeRowConflict,
        });
      }
    },
    [activeRow, conflictMessages.activeRowConflict, payloadBuilders, slice],
  );

  const handleStaleDraftConflict = useCallback(
    async (message: string) => {
      setEditBlocker({ kind: "draft-conflict", message });
      await refetch();
    },
    [refetch],
  );

  const handleVersionLockedConflict = useCallback(async () => {
    setEditBlocker({
      kind: "version-locked",
      message: conflictMessages.versionLocked,
    });
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.detail(projectId) }),
    ];
    if (activeVersionId) {
      invalidations.push(
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.draftSummary(projectId, activeVersionId),
        }),
      );
    }
    await Promise.all(invalidations);
  }, [activeVersionId, conflictMessages.versionLocked, projectId, queryClient]);

  const reloadDraft = useCallback(async () => {
    setEditBlocker(null);
    setActionError(null);
    await refetch();
  }, [refetch]);

  const runWithConflictHandling = useCallback(
    async <T>(
      run: () => Promise<T>,
      conflictMessage: string,
      fallbackMessage: string,
    ): Promise<T | undefined> => {
      if (!canEdit) return undefined;
      setActionError(null);
      try {
        return await run();
      } catch (error) {
        if (error instanceof WriteQueueDrainedError || error instanceof WriteQueueCancelledError) {
          throw error;
        }
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
    },
    [canEdit, handleStaleDraftConflict, handleVersionLockedConflict],
  );

  const resolveSliceForWrite = useCallback(async (): Promise<TSlice> => {
    if (!isEditor || !editorSliceQueryKey) return slice;
    return resolveCachedSliceForWrite(queryClient, editorSliceQueryKey, slice, async () =>
      refetchResultData<TSlice>(await refetch()),
    );
  }, [editorSliceQueryKey, isEditor, queryClient, refetch, slice]);

  const runCoordinatedWrite = useCallback(
    async <T>(task: TransportTask<T>, conflictMessage: string, fallbackMessage: string) => {
      if (!canEdit || !writeCoordinator) return;
      const handle = writeCoordinator.schedule(task);
      const observed = runWithConflictHandling(
        () => handle.settled,
        conflictMessage,
        fallbackMessage,
      );
      void observed.catch(() => undefined);
      await handle.accepted;
      return await observed;
    },
    [canEdit, runWithConflictHandling, writeCoordinator],
  );

  const commitPayloadOrThrow = useJournaledSliceCommit({
    slice,
    coordinator: writeCoordinator,
    queryClient,
    queryKey: editorSliceQueryKey,
    projectId,
    versionId: activeVersionId,
    mutate: replaceMutation.mutateAsync,
    validate: payloadBuilders.validate,
    refetch,
    resolveSliceForWrite,
    runCoordinatedWrite,
    runWithConflictHandling,
    conflictMessage: conflictMessages.activeRowConflict,
    setActionError,
  });

  const commitSchemaMutation = useCallback(
    (mutation: FieldSchemaMutation) =>
      runCoordinatedWrite(
        {
          label: `${tableKey}:schemaMutation`,
          run: async () => {
            const writableSlice = await resolveSliceForWrite();
            return schemaMutation.mutateAsync({ current: writableSlice, mutation });
          },
        },
        conflictMessages.activeRowConflict,
        "Could not update custom-field schema.",
      ),
    [
      conflictMessages.activeRowConflict,
      resolveSliceForWrite,
      runCoordinatedWrite,
      schemaMutation,
      tableKey,
    ],
  );

  const onWrite = useCallback(
    async (op: WriteOp) => {
      if (!canEdit) return;
      if (op.kind === "cell" || op.kind === "paste" || op.kind === "fill") {
        // `fill` shares the CellWrite[] payload shape with `cell` /
        // `paste` but carries no option-list delta (the source values
        // are already in the table — fill never creates options).
        const newOptions =
          op.kind === "paste" ? op.newOptions : op.kind === "cell" ? (op.newOptions ?? {}) : {};
        const removedOptions = op.kind === "fill" ? {} : (op.removedOptions ?? {});
        await commitPayloadOrThrow(
          `${tableKey}:${op.kind}`,
          (writableSlice) => {
            if (op.kind === "paste") {
              return (payloadBuilders.fromPaste ?? composePastePayload(payloadBuilders))(
                writableSlice,
                op,
                buildEmptyRow,
              );
            }
            return payloadBuilders.fromCellWrites(
              writableSlice,
              op.writes,
              newOptions,
              removedOptions,
            );
          },
          conflictMessages.activeRowConflict,
          "Could not update table values.",
          op.kind === "cell"
            ? {
                batchable: true,
                metadata: op,
                buildBatchPayload: (writableSlice, metadata) =>
                  buildCoalescedTablePayload(
                    writableSlice,
                    metadata,
                    payloadBuilders,
                    buildEmptyRow,
                  ),
              }
            : undefined,
        );
        return;
      }
      if (op.kind === "rowInsert") {
        await commitPayloadOrThrow(
          `${tableKey}:rowInsert`,
          (writableSlice) => payloadBuilders.fromRowInsert(writableSlice, op.rows, buildEmptyRow),
          conflictMessages.activeRowConflict,
          "Could not insert row.",
          {
            batchable: true,
            metadata: op,
            buildBatchPayload: (writableSlice, metadata) =>
              buildCoalescedTablePayload(writableSlice, metadata, payloadBuilders, buildEmptyRow),
          },
        );
        return;
      }
      if (op.kind === "rowDelete") {
        await commitPayloadOrThrow(
          `${tableKey}:rowDelete`,
          (writableSlice) => payloadBuilders.fromRowDelete(writableSlice, op.rows),
          conflictMessages.activeRowConflict,
          conflictMessages.deleteConflict,
        );
        return;
      }
      if (op.kind === "rowDuplicate") {
        await commitPayloadOrThrow(
          `${tableKey}:rowDuplicate`,
          (writableSlice) => payloadBuilders.fromRowDuplicate(writableSlice, op.rows),
          conflictMessages.activeRowConflict,
          "Could not duplicate row.",
        );
        return;
      }
      if (op.kind === "schemaMutation") {
        if (op.variant === "typed") {
          await commitSchemaMutation(op.mutation);
          return;
        }
        // Single-select option editor — still rides through the
        // whole-table replace path. Only tabs that ship the legacy
        // option editor implement these hooks; for tabs without it
        // we treat the op as a no-op (the grid would never emit one).
        if (!payloadBuilders.replaceOptions) return;
        const { after } = op;
        if (
          payloadBuilders.isLegacyOptionKey &&
          !payloadBuilders.isLegacyOptionKey(after.field_key)
        ) {
          return;
        }
        const collapse =
          payloadBuilders.collapseCellWritesToReplacements ??
          (() => ({}) as Record<string, string | null>);
        await commitPayloadOrThrow(
          `${tableKey}:schemaOptions`,
          (writableSlice) => {
            const replacements = collapse(writableSlice, after.field_key, op.cellWrites);
            try {
              return payloadBuilders.replaceOptions!(
                writableSlice,
                after.field_key,
                after.options ?? [],
                replacements,
              );
            } catch (error) {
              const message = errorMessage(error, "Could not update options.");
              setActionError(message);
              throw new Error(message);
            }
          },
          conflictMessages.activeRowConflict,
          "Could not update options.",
        );
      }
    },
    [
      buildEmptyRow,
      canEdit,
      commitPayloadOrThrow,
      commitSchemaMutation,
      conflictMessages.activeRowConflict,
      conflictMessages.deleteConflict,
      payloadBuilders,
      tableKey,
    ],
  );

  const customFieldHandlers = useCustomFieldHandlers({
    tableKey,
    canEdit,
    tableSchema,
    view,
    onViewChange,
    commitSchemaMutation,
  });

  return {
    tableSchema,
    view,
    onViewChange,
    onResetView,
    viewLoading,
    onWrite,
    ...customFieldHandlers,
    editBlocker,
    setEditBlocker,
    actionError,
    setActionError,
    canEdit,
    // `isEditor` is the access-principal class (member+), independent of the
    // version lock. Export affordances (CSV/Phius) gate on this, NOT `canEdit`,
    // so an editor browsing a locked version can still export (CP-7).
    isEditor,
    isLocked,
    reloadDraft,
    isReplacePending:
      replaceMutation.isPending ||
      schemaMutation.isPending ||
      writeStatus.inFlight ||
      writeStatus.queued > 0,
    runWithConflictHandling,
    runCoordinatedWrite,
    resolveSliceForWrite,
    notifyRemoteSlice,
  };
}

// Re-exported for consumers that want the canonical FieldRegistryEntry
// without reaching across the data-table package boundary.
export type { FieldRegistryEntry };
