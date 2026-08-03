import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
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
import { envelopeQueryKeys } from "./query-keys";
import type {
  EnvelopeAttachmentChange,
  EnvelopeCommand,
  EnvelopeReadResponse,
  EnvelopeReadSource,
  ThermalStandardsResponse,
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
      queryClient.setQueryData(envelopeQueryKeys.read(projectId, slice.version_id, "draft"), slice);
      writeActiveThermalStandard(queryClient, projectId, slice.version_id, variables.command);
      invalidateMaterialDriftQueries(queryClient, projectId, slice.version_id, variables.command);
      invalidateThermalQueries(queryClient, projectId, slice.version_id, variables.command);
      invalidateCondensationQueries(queryClient, projectId, slice.version_id, variables.command);
      if (statusSummaryInvalidationCommands.has(variables.command.kind)) {
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.statusSummary(projectId, slice.version_id, "editor"),
        });
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.documentationSummary(
            projectId,
            slice.version_id,
            "editor",
          ),
        });
        queryClient.invalidateQueries({
          queryKey: projectDocumentQueryKeys.documentationRollups(projectId),
        });
      }
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
        queryKey: projectDocumentQueryKeys.documentationSummary(projectId, versionId, "editor"),
      });
      await queryClient.invalidateQueries({
        queryKey: projectDocumentQueryKeys.documentationRollups(projectId),
      });
    },
    onError: (error) => {
      onError(errorMessage(error, "Attachment update failed."));
    },
  });
}

// The active standard lives in its own query rather than the command's response
// slice, and `thermal-standards` is a sibling of the `thermal` key, not a child
// — so neither line above refreshes it, and the selector kept showing the
// previous standard until a save changed the query's key.
//
// Written rather than invalidated so the select never flashes back to the old
// label while a refetch is in flight. Writing the requested value is safe: the
// backend resolves the film table *before* storing it, so a success means this
// exact standard landed, and availability is a deployment fact that no command
// can change.
function writeActiveThermalStandard(
  queryClient: QueryClient,
  projectId: string,
  versionId: string,
  command: EnvelopeCommand,
): void {
  if (command.kind !== "set_thermal_standard") return;
  queryClient.setQueryData<ThermalStandardsResponse>(
    envelopeQueryKeys.thermalStandards(projectId, versionId, "draft"),
    (current) => (current ? { ...current, active: command.thermal_standard } : current),
  );
}

function invalidateThermalQueries(
  queryClient: QueryClient,
  projectId: string,
  versionId: string,
  command: EnvelopeCommand,
): void {
  if (command.kind === "set_condensation_settings") return;
  if ("assembly_id" in command && !broadThermalInvalidationCommands.has(command.kind)) {
    queryClient.invalidateQueries({
      queryKey: envelopeQueryKeys.thermal(projectId, versionId, command.assembly_id, "draft"),
    });
    return;
  }
  queryClient.invalidateQueries({ queryKey: [...envelopeQueryKeys.all(projectId), "thermal"] });
}

function invalidateCondensationQueries(
  queryClient: QueryClient,
  projectId: string,
  versionId: string,
  command: EnvelopeCommand,
): void {
  if ("assembly_id" in command && !broadCondensationInvalidationCommands.has(command.kind)) {
    queryClient.invalidateQueries({
      queryKey: envelopeQueryKeys.condensation(projectId, versionId, command.assembly_id, "draft"),
    });
    return;
  }
  queryClient.invalidateQueries({
    queryKey: envelopeQueryKeys.condensationScope(projectId, versionId, "draft"),
  });
}

function invalidateMaterialDriftQueries(
  queryClient: QueryClient,
  projectId: string,
  versionId: string,
  command: EnvelopeCommand,
): void {
  if (!materialDriftInvalidationCommands.has(command.kind)) return;
  queryClient.invalidateQueries({
    queryKey: envelopeQueryKeys.materialDrift(projectId, versionId, "draft"),
  });
}

const broadThermalInvalidationCommands = new Set<EnvelopeCommand["kind"]>([
  // Not an assembly edit, but it re-resolves the films for every one of them.
  "set_thermal_standard",
  "create_assembly",
  "duplicate_assembly",
  "delete_assembly",
  "update_project_material",
  "refresh_project_material_from_catalog",
  "remove_unused_project_materials",
  "remove_project_material",
]);

const broadCondensationInvalidationCommands = new Set<EnvelopeCommand["kind"]>([
  ...broadThermalInvalidationCommands,
  "set_condensation_settings",
]);

const materialDriftInvalidationCommands = new Set<EnvelopeCommand["kind"]>([
  "pick_catalog_material",
  "update_project_material",
  "refresh_project_material_from_catalog",
  "remove_unused_project_materials",
  "remove_project_material",
  "import_envelope_constructions",
]);

const statusSummaryInvalidationCommands = new Set<EnvelopeCommand["kind"]>([
  "pick_catalog_material",
  "hand_enter_material",
  "update_project_material",
  "refresh_project_material_from_catalog",
  "remove_unused_project_materials",
  "remove_project_material",
  "import_envelope_constructions",
]);
