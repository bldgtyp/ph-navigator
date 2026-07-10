import { useCallback, useMemo, useRef } from "react";
import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query";
import type { DraftWriteCoordinator } from "../../../../features/project_document/draftWriteCoordinator";
import { isDraftStaleError } from "../../../../features/project_document/lib";
import {
  mergeSlicePayload,
  SliceWriteJournal,
} from "../../../../features/project_document/sliceWriteJournal";
import {
  refetchResultData,
  type TableReplaceMutationVariables,
} from "../../../../features/project_document/table-slice";
import { errorMessage } from "../../../lib/errors";
import { clearMountedDataTableHistories } from "../historyEvents";
import type { SliceTableController } from "./types";

export type JournalCommitOptions<TSlice, TPayload> = {
  batchable?: boolean;
  metadata?: unknown;
  buildBatchPayload?: (slice: TSlice, metadata: readonly unknown[]) => TPayload;
};

export function useJournaledSliceCommit<TSlice, TPayload>(args: {
  slice: TSlice;
  coordinator: DraftWriteCoordinator | null;
  queryClient: QueryClient;
  queryKey: QueryKey | null;
  projectId: string;
  versionId: string | null;
  mutate: (variables: TableReplaceMutationVariables<TSlice, TPayload>) => Promise<TSlice>;
  validate: (payload: TPayload) => string | null;
  refetch: () => Promise<unknown>;
  resolveSliceForWrite: () => Promise<TSlice>;
  runCoordinatedWrite: SliceTableController<TSlice>["runCoordinatedWrite"];
  runWithConflictHandling: SliceTableController<TSlice>["runWithConflictHandling"];
  conflictMessage: string;
  setActionError: (message: string | null) => void;
}) {
  const latest = useRef(args);
  latest.current = args;
  const journal = useMemo(
    () =>
      args.coordinator && args.queryKey
        ? new SliceWriteJournal<TSlice, TPayload>(
            latest.current.slice,
            args.coordinator,
            (slice, payload) =>
              mergeSlicePayload(slice as TSlice & object, payload as Partial<TSlice>) as TSlice,
            (current, payload) =>
              latest.current.mutate({ current, payload, cachePolicy: "journal-managed" }),
            (rendered) => args.queryClient.setQueryData(args.queryKey!, rendered),
            (error, rejectedCount) => {
              if (latest.current.versionId) {
                clearMountedDataTableHistories({
                  projectId: latest.current.projectId,
                  versionId: latest.current.versionId,
                });
              }
              const noun = rejectedCount === 1 ? "change was" : "changes were";
              const discarded = `${rejectedCount} unsaved ${noun} discarded.`;
              const observed = latest.current.runWithConflictHandling(
                () => Promise.reject(error),
                `${latest.current.conflictMessage} ${discarded}`,
                `Could not update the table. ${discarded}`,
              );
              void observed.catch(() => {
                if (!isDraftStaleError(error)) {
                  latest.current.setActionError(
                    `${errorMessage(error, "Could not update the table.")} ${discarded}`,
                  );
                }
              });
            },
            async (lastAcked, forceRefresh) => {
              const current = latest.current;
              if (
                !current.queryKey ||
                (!forceRefresh &&
                  !current.queryClient.getQueryState(current.queryKey)?.isInvalidated)
              ) {
                return lastAcked;
              }
              return refetchResultData<TSlice>(await current.refetch()) ?? lastAcked;
            },
            hashKey(args.queryKey),
          )
        : null,
    [args.coordinator, args.queryClient, args.queryKey],
  );

  return useCallback(
    async (
      label: string,
      buildPayload: (writableSlice: TSlice) => TPayload,
      conflictMessage: string,
      fallbackMessage: string,
      options: JournalCommitOptions<TSlice, TPayload> = {},
    ) => {
      if (!journal) {
        return await latest.current.runCoordinatedWrite(
          {
            label,
            run: async () => {
              const writableSlice = await latest.current.resolveSliceForWrite();
              const payload = buildPayload(writableSlice);
              const validationMessage = latest.current.validate(payload);
              if (validationMessage) throw new Error(validationMessage);
              return latest.current.mutate({ current: writableSlice, payload });
            },
          },
          conflictMessage,
          fallbackMessage,
        );
      }
      const current = latest.current;
      const refreshBase = current.queryKey
        ? current.queryClient.getQueryState(current.queryKey)?.isInvalidated === true
        : false;
      journal.syncAcknowledgedSlice(current.slice);
      const handle = journal.accept({
        label,
        refreshBase,
        batchable: options.batchable,
        metadata: options.metadata,
        buildPayload,
        buildBatchPayload: options.buildBatchPayload,
        validate: current.validate,
      });
      void handle.settled.catch(() => undefined);
      return await handle.accepted.catch((error: unknown) => {
        current.setActionError(errorMessage(error, fallbackMessage));
        throw error;
      });
    },
    [journal],
  );
}
