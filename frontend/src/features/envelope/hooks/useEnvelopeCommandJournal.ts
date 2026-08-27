// The envelope surface's binding of the shared command journal.
//
// Field-level status writes render on click and drain through the shared
// `DraftWriteCoordinator`; structural commands stay awaited on the same queue.
// See `planning/archive/spec-status-batch-editing/decisions.md` D-1 and D-3,
// and `project_document/useCommandJournal.ts` for the mechanism.
import {
  useCommandJournal,
  type CommandJournal,
  type CommandJournalConfig,
} from "../../project_document/useCommandJournal";
import { envelopeCommandBody, postEnvelopeCommand } from "../api";
import { applyEnvelopeCommandCacheEffects, mergeEnvelopeCommandSlice } from "../command-cache";
import {
  applyJournaledEnvelopeCommand,
  isJournaledEnvelopeCommand,
  journaledEnvelopeRowIds,
  type JournaledEnvelopeCommand,
} from "../command-journal";
import { envelopeQueryKeys } from "../query-keys";
import type { EnvelopeCommand, EnvelopeReadResponse, EnvelopeReadSource } from "../types";

const ENVELOPE_JOURNAL: CommandJournalConfig<
  EnvelopeReadResponse,
  EnvelopeCommand,
  JournaledEnvelopeCommand
> = {
  isJournaled: isJournaledEnvelopeCommand,
  applyCommand: applyJournaledEnvelopeCommand,
  transport: async ({ projectId, versionId, queryClient }, current, commands) => {
    const acknowledged = await postEnvelopeCommand(
      projectId,
      versionId,
      current,
      envelopeCommandBody(commands),
    );
    for (const command of commands) {
      applyEnvelopeCommandCacheEffects(queryClient, projectId, current, acknowledged, command);
    }
    return mergeEnvelopeCommandSlice(current, acknowledged);
  },
  rowIds: journaledEnvelopeRowIds,
  commandRowId: (command) => command.project_material_id,
  readKey: (projectId, versionId) => envelopeQueryKeys.read(projectId, versionId, "draft"),
  coalesceNamespace: "envelope-commands",
  fallbackErrorMessage: "Envelope command failed.",
};

export function useEnvelopeCommandJournal(args: {
  projectId: string;
  versionId: string | null;
  source: EnvelopeReadSource;
  slice: EnvelopeReadResponse | undefined;
  refetch: () => Promise<unknown>;
  setCommandError: (message: string | null) => void;
}): CommandJournal<EnvelopeCommand> {
  return useCommandJournal(ENVELOPE_JOURNAL, {
    projectId: args.projectId,
    versionId: args.versionId,
    writable: args.source === "draft",
    slice: args.slice,
    refetch: args.refetch,
    setError: args.setCommandError,
  });
}
