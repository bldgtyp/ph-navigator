import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { markLocalDraftTouched } from "../project_document/lib";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import { applyApertureCommand, fetchAperturesSlice, fetchApertureSpecReport } from "./api";
import { apertureDriftReportQueryKey } from "./hooks/useApertureDriftReport";
import { apertureUValuesQueryKey } from "./hooks/useApertureUValues";
import { apertureQueryKeys } from "./query-keys";
import type { ApertureCommand, ApertureReadSource, AperturesSlice } from "./types";

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
