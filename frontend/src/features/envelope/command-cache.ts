// Cache work every envelope command does after the server answers, shared by
// the awaited mutation (`useEnvelopeCommandMutation`) and the optimistic write
// journal (`useEnvelopeCommandJournal`).
//
// Only the *ancillary* effects live here. Writing the envelope read model
// itself is the caller's job, because the journal owns that cache entry while
// writes are outstanding and must not have an acknowledgement dropped on top
// of a still-unacked optimistic render.
import type { QueryClient } from "@tanstack/react-query";
import { markLocalDraftTouched } from "../project_document/lib";
import { projectDocumentQueryKeys } from "../project_document/query-keys";
import { envelopeQueryKeys } from "./query-keys";
import type { EnvelopeCommand, EnvelopeReadResponse, ThermalStandardsResponse } from "./types";

/**
 * The command response omits `saved_assembly_count`; carry the pre-command
 * value forward so the header does not flicker to "unknown" after every edit.
 */
export function mergeEnvelopeCommandSlice(
  previous: EnvelopeReadResponse,
  slice: EnvelopeReadResponse,
): EnvelopeReadResponse {
  return {
    ...slice,
    saved_assembly_count: slice.saved_assembly_count ?? previous.saved_assembly_count,
  };
}

export function applyEnvelopeCommandCacheEffects(
  queryClient: QueryClient,
  projectId: string,
  previous: EnvelopeReadResponse,
  slice: EnvelopeReadResponse,
  command: EnvelopeCommand,
): void {
  writeActiveThermalStandard(queryClient, projectId, slice.version_id, command);
  invalidateMaterialDriftQueries(queryClient, projectId, slice.version_id, command);
  invalidateThermalQueries(queryClient, projectId, slice.version_id, command);
  invalidateCondensationQueries(queryClient, projectId, slice.version_id, command);
  if (documentationSummaryInvalidationCommands.has(command.kind)) {
    queryClient.invalidateQueries({ queryKey: projectDocumentQueryKeys.documentation(projectId) });
  }
  if (slice.draft_etag !== previous.draft_etag) {
    markLocalDraftTouched(projectId, slice.version_id, slice.draft_etag);
    queryClient.invalidateQueries({
      queryKey: projectDocumentQueryKeys.draftSummary(projectId, slice.version_id),
    });
  }
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
  if (!movesThermalInputs(command)) return;
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
  if (!movesThermalInputs(command)) return;
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

/**
 * `update_project_material` is in both broad sets because a conductivity or
 * vapour change re-derives every assembly's U-value and dew-point profile. Its
 * fields are all optional, though, so a status-only edit moves nothing thermal
 * — and refetching thermal + condensation for every assembly on each of a
 * twenty-click status pass is pure waste (PRD S-5).
 */
function movesThermalInputs(command: EnvelopeCommand): boolean {
  if (command.kind !== "update_project_material") return true;
  return THERMAL_MATERIAL_FIELDS.some((field) => command[field] !== undefined);
}

const THERMAL_MATERIAL_FIELDS = [
  "conductivity_w_mk",
  "density_kg_m3",
  "specific_heat_j_kgk",
  "emissivity",
  "air_permeance_l_s_m2_at_75pa",
  "vapor_diffusion_resistance_mu",
  "vapor_sd_equivalent_m",
] as const satisfies readonly (keyof Extract<
  EnvelopeCommand,
  { kind: "update_project_material" }
>)[];

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

const documentationSummaryInvalidationCommands = new Set<EnvelopeCommand["kind"]>([
  "pick_catalog_material",
  "hand_enter_material",
  "update_project_material",
  "refresh_project_material_from_catalog",
  "remove_unused_project_materials",
  "remove_project_material",
  "import_envelope_constructions",
]);
