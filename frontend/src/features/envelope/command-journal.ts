// Which envelope commands may be written optimistically, and what applying one
// to the cached read model looks like. See
// `planning/archive/spec-status-batch-editing/decisions.md` D-1 for why the
// gate is per-field rather than per-command-kind.
import { definedFieldPatch, patchesOnlyFields } from "../project_document/commandFieldPatch";
import { patchRowById } from "../project_document/sliceRowPatch";
import type { EnvelopeCommand, EnvelopeReadResponse } from "./types";

export type JournaledEnvelopeCommand = Extract<
  EnvelopeCommand,
  { kind: "update_project_material" }
>;

/**
 * The `update_project_material` fields whose server effect the client can
 * reproduce exactly.
 *
 * The backend applies this command with `exclude_unset`, then records any
 * touched catalog field in `catalog_origin.local_overrides`. Neither of these
 * is a catalog field, so a command that carries nothing else lands exactly
 * where `applyJournaledEnvelopeCommand` puts it. Anything wider (the material
 * editor modal) stays on the awaited path, where the server's answer is the
 * only rendering.
 */
export const JOURNALED_MATERIAL_FIELDS = [
  "specification_status",
  "datasheet_not_required",
] as const;
const IDENTITY_KEYS = ["kind", "project_material_id"] as const;

/** True when `command` patches only journaled fields on one existing material. */
export function isJournaledEnvelopeCommand(
  command: EnvelopeCommand,
): command is JournaledEnvelopeCommand {
  return (
    command.kind === "update_project_material" &&
    patchesOnlyFields(command, JOURNALED_MATERIAL_FIELDS, IDENTITY_KEYS)
  );
}

/**
 * Every row id a journaled command could target, for the conflict-recovery
 * check. Kept beside the command gate so widening one widens the other.
 */
export function journaledEnvelopeRowIds(slice: EnvelopeReadResponse): ReadonlySet<string> {
  return new Set(slice.project_materials.map((material) => material.id));
}

/** Apply a journaled command to a read-model slice, exactly as the server will. */
export function applyJournaledEnvelopeCommand(
  slice: EnvelopeReadResponse,
  command: JournaledEnvelopeCommand,
): EnvelopeReadResponse {
  const project_materials = patchRowById(
    slice.project_materials,
    command.project_material_id,
    definedFieldPatch(command, JOURNALED_MATERIAL_FIELDS),
  );
  return project_materials ? { ...slice, project_materials } : slice;
}
