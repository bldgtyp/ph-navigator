import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UnitSystem } from "../../lib/units/types";
import { downloadBlob } from "../../shared/lib/downloadBlob";
import { errorMessage } from "../../shared/lib/errors";
import { attachAssetToDocument, detachAssetFromDocument } from "../assets/api";
import { markLocalDraftTouched } from "../project_document/lib";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import {
  downloadEnvelopeHbjson,
  downloadEnvelopePhpp,
  fetchAssemblyCondensation,
  fetchAssemblyThermal,
  fetchEnvelopeReadModel,
  fetchMaterialCatalogDrift,
  fetchPhppPreflight,
  postEnvelopeCommand,
  previewEnvelopeHbjsonImport,
  fetchThermalStandards,
} from "./api";
import { applyEnvelopeCommandCacheEffects, mergeEnvelopeCommandSlice } from "./command-cache";
import { envelopeQueryKeys } from "./query-keys";
import type {
  EnvelopeAttachmentChange,
  EnvelopeCommand,
  EnvelopeReadResponse,
  EnvelopeReadSource,
} from "./types";

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
      queryClient.setQueryData(
        envelopeQueryKeys.read(projectId, slice.version_id, "draft"),
        mergeEnvelopeCommandSlice(variables.current, slice),
      );
      applyEnvelopeCommandCacheEffects(
        queryClient,
        projectId,
        variables.current,
        slice,
        variables.command,
      );
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

export function useAssemblyCondensationQuery(
  projectId: string,
  versionId: string | null,
  assemblyId: string | null,
  source: EnvelopeReadSource,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  const resolvedAssemblyId = assemblyId ?? "";
  return useQuery({
    queryKey: envelopeQueryKeys.condensation(
      projectId,
      resolvedVersionId,
      resolvedAssemblyId,
      source,
    ),
    queryFn: ({ signal }) =>
      fetchAssemblyCondensation(projectId, resolvedVersionId, resolvedAssemblyId, source, signal),
    enabled: enabled && resolvedVersionId.length > 0 && resolvedAssemblyId.length > 0,
  });
}

export function useThermalStandardsQuery(
  projectId: string,
  versionId: string | null,
  source: EnvelopeReadSource,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: envelopeQueryKeys.thermalStandards(projectId, resolvedVersionId, source),
    queryFn: ({ signal }) => fetchThermalStandards(projectId, resolvedVersionId, source, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useMaterialCatalogDriftQuery(
  projectId: string,
  versionId: string | null,
  source: EnvelopeReadSource,
  enabled = true,
) {
  const resolvedVersionId = versionId ?? "";
  return useQuery({
    queryKey: envelopeQueryKeys.materialDrift(projectId, resolvedVersionId, source),
    queryFn: ({ signal }) =>
      fetchMaterialCatalogDrift(projectId, resolvedVersionId, source, signal),
    enabled: enabled && resolvedVersionId.length > 0,
  });
}

export function useEnvelopeHbjsonImportPreviewMutation(
  projectId: string,
  versionId: string | null,
) {
  return useMutation({
    mutationFn: (file: File) => {
      if (!versionId) throw new Error("Select a version before importing constructions.");
      return previewEnvelopeHbjsonImport(projectId, versionId, file);
    },
  });
}

export function useEnvelopeHbjsonExportMutation(projectId: string, versionId: string | null) {
  return useMutation({
    mutationFn: async () => {
      if (!versionId) throw new Error("Select a version before exporting envelope assemblies.");
      const blob = await downloadEnvelopeHbjson(projectId, versionId);
      downloadBlob(blob, `envelope-constructions-${versionId}.hbjson`);
    },
  });
}

export function useEnvelopePhppPreflightMutation(projectId: string, versionId: string | null) {
  return useMutation({
    mutationFn: () => {
      if (!versionId) throw new Error("Select a version before exporting envelope assemblies.");
      return fetchPhppPreflight(projectId, versionId);
    },
  });
}

export function useEnvelopePhppExportMutation(projectId: string, versionId: string | null) {
  return useMutation({
    mutationFn: async (units: UnitSystem) => {
      if (!versionId) throw new Error("Select a version before exporting envelope assemblies.");
      const blob = await downloadEnvelopePhpp(projectId, versionId, units);
      downloadBlob(blob, `phpp-u-values-${units}-${versionId}.zip`);
    },
  });
}

export function useEnvelopeAttachmentMutation({
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
      current: EnvelopeReadResponse;
      change: EnvelopeAttachmentChange;
    }) => {
      if (!versionId) throw new Error("Select a version before editing envelope attachments.");
      let draftEtag = current.draft_etag;
      const changes = Array.isArray(change) ? change : [change];
      for (const item of changes) {
        const removed = item.currentAssetIds.filter(
          (assetId) => !item.nextAssetIds.includes(assetId),
        );
        const added = item.nextAssetIds.filter(
          (assetId) => !item.currentAssetIds.includes(assetId),
        );
        for (const assetId of removed) {
          const response = await detachAssetFromDocument(projectId, assetId, {
            version_id: versionId,
            table_key: item.tableKey,
            row_id: item.rowId,
            field_key: item.fieldKey,
            if_match: draftEtag,
            if_match_version: draftEtag ? undefined : current.version_etag,
          });
          draftEtag = response.draft_etag;
        }
        for (const assetId of added) {
          const response = await attachAssetToDocument(projectId, assetId, {
            version_id: versionId,
            table_key: item.tableKey,
            row_id: item.rowId,
            field_key: item.fieldKey,
            index: item.nextAssetIds.indexOf(assetId),
            if_match: draftEtag,
            if_match_version: draftEtag ? undefined : current.version_etag,
          });
          draftEtag = response.draft_etag;
        }
      }
      return { draftEtag };
    },
    onSuccess: async ({ draftEtag }) => {
      if (!versionId) return;
      if (draftEtag) {
        markLocalDraftTouched(projectId, versionId, draftEtag);
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.draftSummary(projectId, versionId),
        });
      }
      await queryClient.invalidateQueries({
        queryKey: envelopeQueryKeys.read(projectId, versionId, "draft"),
      });
      await queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.documentation(projectId),
      });
    },
    onError: (error) => {
      onError(errorMessage(error, "Attachment update failed."));
    },
  });
}
