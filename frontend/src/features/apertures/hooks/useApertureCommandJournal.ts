// The Apertures spec-report surface's binding of the shared command journal.
//
// Glazings / Frames status writes render on change and queue on the same
// `DraftWriteCoordinator` the Envelope and DataTable surfaces use. See
// `planning/archive/spec-status-batch-editing/decisions.md` D-1, and
// `project_document/useCommandJournal.ts` for the mechanism.
import { markLocalDraftTouched } from "../../project_document/lib";
import { projectDocumentQueryKeys } from "../../project_document/query-keys";
import {
  useCommandJournal,
  type CommandJournal,
  type CommandJournalConfig,
} from "../../project_document/useCommandJournal";
import { applyApertureProductCommands } from "../api";
import { apertureQueryKeys } from "../query-keys";
import {
  applyJournaledApertureCommand,
  isJournaledApertureCommand,
  journaledApertureCommandRowId,
  journaledApertureRowIds,
  type JournaledApertureCommand,
} from "../command-journal";
import type {
  ApertureProductCommand,
  ApertureReadSource,
  ApertureSpecReportResponse,
} from "../types";

const APERTURE_JOURNAL: CommandJournalConfig<
  ApertureSpecReportResponse,
  ApertureProductCommand,
  JournaledApertureCommand
> = {
  isJournaled: isJournaledApertureCommand,
  applyCommand: applyJournaledApertureCommand,
  transport: async ({ projectId, versionId, queryClient }, current, commands) => {
    const result = await applyApertureProductCommands(projectId, versionId, current, commands);
    // The command endpoint answers with the envelope read model, not this
    // slice, so the acknowledgement is the optimistic projection plus the
    // server's new ETags. That is exact for evidence-only commands, which is
    // the whole reason only those are journaled.
    const acknowledged: ApertureSpecReportResponse = {
      ...commands.reduce(applyJournaledApertureCommand, current),
      version_id: result.version_id || current.version_id,
      version_etag: result.version_etag ?? current.version_etag,
      draft_etag: result.draft_etag,
    };
    if (result.draft_etag) {
      markLocalDraftTouched(projectId, acknowledged.version_id, result.draft_etag);
    }
    if (result.draft_etag !== current.draft_etag) {
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, acknowledged.version_id),
      });
    }
    // Evidence status feeds the documentation rollups. It moves no geometry,
    // U-value, or catalog-drift input, so the report queries that used to be
    // invalidated on every write are deliberately left alone.
    queryClient.invalidateQueries({ queryKey: projectDocumentQueryKeys.documentation(projectId) });
    return acknowledged;
  },
  rowIds: journaledApertureRowIds,
  commandRowId: journaledApertureCommandRowId,
  readKey: (projectId, versionId) => apertureQueryKeys.specReport(projectId, versionId, "draft"),
  coalesceNamespace: "aperture-product-commands",
  fallbackErrorMessage: "Could not update aperture specification.",
};

export function useApertureCommandJournal(args: {
  projectId: string;
  versionId: string | null;
  source: ApertureReadSource;
  slice: ApertureSpecReportResponse | undefined;
  refetch: () => Promise<unknown>;
  setActionError: (message: string | null) => void;
}): CommandJournal<ApertureProductCommand> {
  return useCommandJournal(APERTURE_JOURNAL, {
    projectId: args.projectId,
    versionId: args.versionId,
    writable: args.source === "draft",
    slice: args.slice,
    refetch: args.refetch,
    setError: args.setActionError,
  });
}
