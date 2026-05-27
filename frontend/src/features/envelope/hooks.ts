import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { markLocalDraftTouched } from "../project_document/lib";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import {
  downloadEnvelopeHbjson,
  fetchAssemblyThermal,
  fetchEnvelopeReadModel,
  postEnvelopeCommand,
} from "./api";
import { envelopeQueryKeys } from "./query-keys";
import type { EnvelopeCommand, EnvelopeReadResponse, EnvelopeReadSource } from "./types";

export function useEnvelopeReadQuery(
  projectId: string,
  versionId: string | null,
  source: EnvelopeReadSource,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: envelopeQueryKeys.read(projectId, resolvedVersionId, source),
    queryFn: ({ signal }) => fetchEnvelopeReadModel(projectId, resolvedVersionId, source, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useEnvelopeCommandMutation(projectId: string, versionId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      current,
      command,
    }: {
      current: EnvelopeReadResponse;
      command: EnvelopeCommand;
    }) => {
      if (!versionId) throw new Error("Select a version before editing envelope assemblies.");
      return postEnvelopeCommand(projectId, versionId, current, { command });
    },
    onSuccess: (slice, variables) => {
      queryClient.setQueryData(envelopeQueryKeys.read(projectId, slice.version_id, "draft"), slice);
      invalidateThermalQueries(queryClient, projectId, slice.version_id, variables.command);
      if (slice.draft_etag !== variables.current.draft_etag) {
        markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
        });
      }
    },
  });
}

export function useAssemblyThermalQuery(
  projectId: string,
  versionId: string | null,
  assemblyId: string | null,
  source: EnvelopeReadSource,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  const resolvedAssemblyId = assemblyId ?? "";
  return useQuery({
    queryKey: envelopeQueryKeys.thermal(projectId, resolvedVersionId, resolvedAssemblyId, source),
    queryFn: ({ signal }) =>
      fetchAssemblyThermal(projectId, resolvedVersionId, resolvedAssemblyId, source, signal),
    enabled: enabled && resolvedVersionId.length > 0 && resolvedAssemblyId.length > 0,
  });
}

export function useEnvelopeHbjsonExportMutation(projectId: string, versionId: string | null) {
  return useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error("Select a version before exporting envelope assemblies.");
      const blob = await downloadEnvelopeHbjson(projectId, versionId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      try {
        link.href = url;
        link.download = `envelope-constructions-${versionId}.hbjson`;
        document.body.append(link);
        link.click();
      } finally {
        link.remove();
        URL.revokeObjectURL(url);
      }
    },
  });
}

function invalidateThermalQueries(
  queryClient: QueryClient,
  projectId: string,
  versionId: string,
  command: EnvelopeCommand,
): void {
  if ("assembly_id" in command && !broadThermalInvalidationCommands.has(command.kind)) {
    queryClient.invalidateQueries({
      queryKey: envelopeQueryKeys.thermal(projectId, versionId, command.assembly_id, "draft"),
    });
    return;
  }
  queryClient.invalidateQueries({ queryKey: [...envelopeQueryKeys.all(projectId), "thermal"] });
}

const broadThermalInvalidationCommands = new Set<EnvelopeCommand["kind"]>([
  "create_assembly",
  "duplicate_assembly",
  "delete_assembly",
  "update_project_material",
  "remove_unused_project_materials",
]);
