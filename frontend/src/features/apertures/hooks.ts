import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "../../shared/lib/errors";
import { attachAssetToDocument, detachAssetFromDocument } from "../assets/api";
import { markLocalDraftTouched } from "../project_document/lib";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import {
  applyApertureCommand,
  applyApertureProductCommand,
  applyApertureReportRefreshCommand,
  fetchAperturesSlice,
  fetchApertureSpecReport,
} from "./api";
import { apertureDriftReportQueryKey } from "./hooks/useApertureDriftReport";
import { apertureUValuesQueryKey } from "./hooks/useApertureUValues";
import { apertureQueryKeys } from "./query-keys";
import type {
  ApertureAttachmentChangeArgs,
  ApertureCommand,
  ApertureProductCommand,
  ApertureReadSource,
  ApertureSpecReportResponse,
  AperturesSlice,
} from "./types";

/** Wire kinds whose audit envelope sets ``affects_u_value=true``. The
 *  list mirrors the backend audit flag; keeping it client-side keeps
 *  invalidations from waiting for the audit envelope to round-trip.
 *  ``setElementOperation`` and ``setElementName`` are intentionally
 *  absent — PRD §14 keeps operation / name orthogonal to U-value. */
const U_VALUE_AFFECTING_KINDS = new Set<ApertureCommand["kind"]>([
  "createApertureType",
  "duplicateApertureType",
  "deleteApertureType",
  "editDimension",
  "addRow",
  "addColumn",
  "deleteRow",
  "deleteColumn",
  "pickFrame",
  "pickGlazing",
  "mergeElements",
  "splitElement",
  "pasteAssignment",
  "flipLeftRight",
]);

/** Wire kinds that change a catalog-aware ref shape (origin / fields)
 *  or the document's ref population, so the drift report needs a
 *  re-fetch to reflect the new state. ``refreshRefFromCatalog`` is the
 *  obvious one; the structural commands also reshuffle which refs
 *  exist or which catalog rows they point at. */
const DRIFT_AFFECTING_KINDS = new Set<ApertureCommand["kind"]>([
  "createApertureType",
  "duplicateApertureType",
  "deleteApertureType",
  "addRow",
  "addColumn",
  "deleteRow",
  "deleteColumn",
  "pickFrame",
  "pickGlazing",
  "mergeElements",
  "splitElement",
  "pasteAssignment",
  "flipLeftRight",
  "refreshRefFromCatalog",
]);

export function useAperturesSliceQuery(
  projectId: string,
  versionId: string | null,
  accessMode: "editor" | "viewer",
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: apertureQueryKeys.slice(projectId, resolvedVersionId, accessMode),
    queryFn: ({ signal }) => fetchAperturesSlice(projectId, resolvedVersionId, accessMode, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useApertureSpecReportQuery(
  projectId: string,
  versionId: string | null,
  source: ApertureReadSource,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: apertureQueryKeys.specReport(projectId, resolvedVersionId, source),
    queryFn: ({ signal }) => fetchApertureSpecReport(projectId, resolvedVersionId, source, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useApertureProductCommandMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      current,
      command,
    }: {
      current: ApertureSpecReportResponse;
      command: ApertureProductCommand;
    }) => {
      if (!versionId) {
        throw new Error("Cannot apply an aperture product command without an active version.");
      }
      return applyApertureProductCommand(projectId, versionId, current, command);
    },
    onSuccess: async (result, variables) => {
      const resolvedVersionId = result.version_id || variables.current.version_id;
      if (result.draft_etag) markLocalDraftTouched(projectId, resolvedVersionId, result.draft_etag);
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.statusSummary(projectId, resolvedVersionId, "editor"),
      });
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.documentationSummary(
          projectId,
          resolvedVersionId,
          "editor",
        ),
      });
      await invalidateApertureReportQueries(queryClient, projectId, resolvedVersionId);
    },
  });
}

export function useApertureReportRefreshMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      current,
      command,
    }: {
      current: ApertureSpecReportResponse;
      command: Extract<ApertureCommand, { kind: "refreshRefFromCatalog" }>;
    }) => {
      if (!versionId) {
        throw new Error("Cannot refresh an aperture ref without an active version.");
      }
      return applyApertureReportRefreshCommand(projectId, versionId, current, command);
    },
    onSuccess: async (result, variables) => {
      const resolvedVersionId = result.version_id || variables.current.version_id;
      if (result.draft_etag) markLocalDraftTouched(projectId, resolvedVersionId, result.draft_etag);
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.statusSummary(projectId, resolvedVersionId, "editor"),
      });
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.documentationSummary(
          projectId,
          resolvedVersionId,
          "editor",
        ),
      });
      await invalidateApertureReportQueries(queryClient, projectId, resolvedVersionId);
    },
  });
}

export function useApertureReportAttachmentMutation({
  projectId,
  versionId,
  onError,
}: {
  projectId: string;
  versionId: string | null;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      current,
      change,
    }: {
      current: ApertureSpecReportResponse;
      change: ApertureAttachmentChangeArgs;
    }) => {
      if (!versionId) throw new Error("Select a version before editing aperture attachments.");
      let draftEtag = current.draft_etag;
      const removed = change.currentAssetIds.filter(
        (assetId) => !change.nextAssetIds.includes(assetId),
      );
      const added = change.nextAssetIds.filter(
        (assetId) => !change.currentAssetIds.includes(assetId),
      );
      for (const assetId of removed) {
        const response = await detachAssetFromDocument(projectId, assetId, {
          version_id: versionId,
          table_key: change.tableKey,
          row_id: change.rowId,
          field_key: change.fieldKey,
          if_match: draftEtag,
          if_match_version: draftEtag ? undefined : current.version_etag,
        });
        draftEtag = response.draft_etag;
      }
      for (const assetId of added) {
        const response = await attachAssetToDocument(projectId, assetId, {
          version_id: versionId,
          table_key: change.tableKey,
          row_id: change.rowId,
          field_key: change.fieldKey,
          index: change.nextAssetIds.indexOf(assetId),
          if_match: draftEtag,
          if_match_version: draftEtag ? undefined : current.version_etag,
        });
        draftEtag = response.draft_etag;
      }
      return { draftEtag, versionId };
    },
    onSuccess: async ({ draftEtag, versionId: resolvedVersionId }) => {
      if (draftEtag) {
        markLocalDraftTouched(projectId, resolvedVersionId, draftEtag);
      }
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.documentationSummary(
          projectId,
          resolvedVersionId,
          "editor",
        ),
      });
      await invalidateApertureReportQueries(queryClient, projectId, resolvedVersionId);
    },
    onError: (error) => {
      onError(errorMessage(error, "Attachment update failed."));
    },
  });
}

export function useApplyApertureCommandMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ current, command }: { current: AperturesSlice; command: ApertureCommand }) => {
      if (!versionId) {
        throw new Error("Cannot apply an aperture command without an active project version.");
      }
      return applyApertureCommand(projectId, versionId, current, command);
    },
    onSuccess: (slice, variables) => {
      markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
      queryClient.setQueryData(
        apertureQueryKeys.slice(projectId, slice.version_id, "editor"),
        slice,
      );
      queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
      });
      if (U_VALUE_AFFECTING_KINDS.has(variables.command.kind)) {
        queryClient.invalidateQueries({
          queryKey: apertureUValuesQueryKey(projectId, slice.version_id, slice.source),
        });
      }
      if (DRIFT_AFFECTING_KINDS.has(variables.command.kind)) {
        queryClient.invalidateQueries({
          queryKey: apertureDriftReportQueryKey(projectId, slice.version_id, slice.source),
        });
      }
    },
  });
}

async function invalidateApertureReportQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
  versionId: string,
): Promise<void> {
  queryClient.invalidateQueries({
    queryKey: projectDocumentQueryKeys.draftSummary(projectId, versionId),
  });
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: apertureQueryKeys.specReport(projectId, versionId, "draft"),
    }),
    queryClient.invalidateQueries({
      queryKey: apertureDriftReportQueryKey(projectId, versionId, "draft"),
    }),
  ]);
}
