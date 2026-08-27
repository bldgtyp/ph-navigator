// Optimistic, queued transport for a semantic-command surface.
//
// A command surface that qualifies (see `isJournaled`) renders on the client
// immediately, queues its write on the shared `DraftWriteCoordinator`, and
// coalesces with adjacent queued writes into one request. Commands that do not
// qualify — structural ones that navigate, open dialogs, or change which rows
// exist — stay awaited, but run on the same queue so the two cannot interleave.
//
// Callers supply the eight things that actually differ between surfaces (see
// `CommandJournalConfig`); the queue, failure reporting, base refresh, and
// conflict rebase are the same for all of them. Envelope and Apertures both
// use this.
import { useCallback, useRef, type MutableRefObject } from "react";
import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { getDraftWriteCoordinator, type DraftWriteCoordinator } from "./draftWriteCoordinator";
import { refreshInvalidatedBase } from "./journalBase";
import { classifyDraftConflict, discardedWriteFailureMessage, draftConflictMessage } from "./lib";
import { SliceWriteJournal } from "./sliceWriteJournal";
import { refetchResultData } from "./table-slice";

type Kinded = { kind: string };

export type CommandJournalConfig<TSlice, TWide extends Kinded, TCommand extends TWide> = {
  /** Distinguishes commands the client can render exactly from ones it cannot. */
  isJournaled: (command: TWide) => command is TCommand;
  /** Reproduce one command's server effect on a slice. Must match the server exactly. */
  applyCommand: (slice: TSlice, command: TCommand) => TSlice;
  /** Send a run of commands against an acknowledged base and return the new acknowledgement. */
  transport: (
    context: { projectId: string; versionId: string; queryClient: QueryClient },
    slice: TSlice,
    commands: TCommand[],
  ) => Promise<TSlice>;
  /** Every row id a journaled command could target, for the conflict-rebase check. */
  rowIds: (slice: TSlice) => ReadonlySet<string>;
  commandRowId: (command: TCommand) => string;
  /** The cache entry the journal owns while writes are outstanding. */
  readKey: (projectId: string, versionId: string) => QueryKey;
  /** Namespaces the coalesce key so only this surface's writes batch together. */
  coalesceNamespace: string;
  fallbackErrorMessage: string;
};

export type CommandJournal<TWide> = {
  /**
   * Render `command` immediately and queue its write, returning true when it
   * was accepted. Returns false for a command this surface cannot journal — a
   * structural kind, or a read-only version — so the caller falls straight
   * through to the awaited path without repeating the eligibility test.
   */
  submit: (command: TWide) => boolean;
  /**
   * Render a whole run at once and send it as **one** request, for a batch
   * gesture where the user acted on N rows in a single motion. Returns false
   * unless every command is journalable.
   */
  submitAll: (commands: readonly TWide[]) => boolean;
  /** Run an awaited write on the same queue, so it cannot interleave with journaled ones. */
  enqueue: <T>(label: string, run: () => Promise<T>) => Promise<T>;
};

export type CommandJournalArgs<TSlice> = {
  projectId: string;
  versionId: string | null;
  /** False for a viewer or a locked version, which has no draft to journal into. */
  writable: boolean;
  slice: TSlice | undefined;
  refetch: () => Promise<unknown>;
  setError: (message: string | null) => void;
};

// A run of commands, so queued writes can coalesce: the coordinator hands
// adjacent batchable entries to `buildBatchPayload`, and the endpoint applies
// the run inside one document write.
type Journal<TSlice, TCommand> = SliceWriteJournal<TSlice, TCommand[]>;
type Held<TSlice, TCommand> = MutableRefObject<{
  key: string;
  journal: Journal<TSlice, TCommand>;
} | null>;

/** A version this surface may write a draft against, with the derived cache handles. */
type DraftTarget = { versionId: string; coordinator: DraftWriteCoordinator; readKey: QueryKey };

export function useCommandJournal<TSlice, TWide extends Kinded, TCommand extends TWide>(
  config: CommandJournalConfig<TSlice, TWide, TCommand>,
  args: CommandJournalArgs<TSlice>,
): CommandJournal<TWide> {
  const queryClient = useQueryClient();
  const latest = useRef(args);
  latest.current = args;
  // The journal has to outlive renders but cannot be built before the slice
  // arrives, so it is created on first use and re-created whenever the
  // project/version it is anchored to changes.
  const held: Held<TSlice, TCommand> = useRef(null);

  const submitAll = useCallback(
    (commands: readonly TWide[]): boolean => {
      if (commands.length === 0) return false;
      if (!commands.every((command) => config.isJournaled(command))) return false;
      const run = commands as readonly TCommand[];
      const target = draftTarget(config, latest.current);
      const journal = target && ensureJournal(config, held, latest, queryClient, target);
      if (!journal || latest.current.slice === undefined) return false;
      journal.syncAcknowledgedSlice(latest.current.slice);
      const handle = journal.accept({
        label: run.length === 1 ? run[0]!.kind : `${run[0]!.kind} ×${run.length}`,
        refreshBase: queryClient.getQueryState(target.readKey)?.isInvalidated === true,
        // A run already *is* one request; batching lets it merge with whatever
        // else is queued behind the same key.
        batchable: true,
        metadata: run,
        buildPayload: () => [...run],
        buildBatchPayload: (_slice, queued) => queued.flat() as TCommand[],
        validate: () => null,
      });
      // Failures are reported through the journal's `onFailure`; this handle is
      // only observed so an unhandled rejection is never raised.
      void handle.settled.catch(() => undefined);
      return true;
    },
    [config, queryClient],
  );

  const submit = useCallback((command: TWide): boolean => submitAll([command]), [submitAll]);

  const enqueue = useCallback(
    <T>(label: string, run: () => Promise<T>): Promise<T> => {
      const target = draftTarget(config, latest.current);
      if (!target) return run();
      return target.coordinator.schedule<T>({ label, run }).settled;
    },
    [config],
  );

  return { submit, submitAll, enqueue };
}

function ensureJournal<TSlice, TWide extends Kinded, TCommand extends TWide>(
  config: CommandJournalConfig<TSlice, TWide, TCommand>,
  held: Held<TSlice, TCommand>,
  latest: MutableRefObject<CommandJournalArgs<TSlice>>,
  queryClient: QueryClient,
  target: DraftTarget,
): Journal<TSlice, TCommand> | null {
  const { projectId, slice } = latest.current;
  if (slice === undefined) return null;
  if (held.current?.key === target.coordinator.key) return held.current.journal;

  const journal: Journal<TSlice, TCommand> = new SliceWriteJournal(slice, {
    coordinator: target.coordinator,
    applyPayload: (current, commands) => commands.reduce(config.applyCommand, current),
    transport: (current, commands) =>
      config.transport({ projectId, versionId: target.versionId, queryClient }, current, commands),
    render: (rendered) => queryClient.setQueryData(target.readKey, rendered),
    onFailure: (error, rejectedCount, baseRefreshed) => {
      const conflict = classifyDraftConflict(error);
      latest.current.setError(
        conflict
          ? draftConflictMessage(error, rejectedCount)
          : discardedWriteFailureMessage(error, rejectedCount, config.fallbackErrorMessage),
      );
      // A conflict the journal could not rebase past leaves the reverted render
      // showing a base the server has already moved on from.
      if (conflict && !baseRefreshed) void latest.current.refetch();
    },
    prepareBase: refreshInvalidatedBase<TSlice>(() => ({
      queryClient,
      queryKey: target.readKey,
      refetch: latest.current.refetch,
    })),
    coalesceKey: `${config.coalesceNamespace}:${target.coordinator.key}`,
    recoverBase: async (error, metadata) => {
      // Another tab, editor, or agent moved the draft. Rebase onto the fresh
      // draft and retry, but only while every target row still exists — a
      // journaled write is a blind field overwrite, so a surviving row is the
      // whole precondition.
      if (classifyDraftConflict(error) !== "draft-etag") return null;
      const fresh = refetchResultData<TSlice>(await latest.current.refetch());
      if (fresh === null) return null;
      const ids = config.rowIds(fresh);
      return {
        base: fresh,
        retryAllowed: metadata.flat().every((entry) => {
          const command = entry as TWide;
          return config.isJournaled(command) && ids.has(config.commandRowId(command));
        }),
      };
    },
  });
  held.current = { key: target.coordinator.key, journal };
  return journal;
}

function draftTarget<TSlice, TWide extends Kinded, TCommand extends TWide>(
  config: CommandJournalConfig<TSlice, TWide, TCommand>,
  args: CommandJournalArgs<TSlice>,
): DraftTarget | null {
  if (!args.versionId || !args.writable) return null;
  return {
    versionId: args.versionId,
    coordinator: getDraftWriteCoordinator(args.projectId, args.versionId),
    readKey: config.readKey(args.projectId, args.versionId),
  };
}
