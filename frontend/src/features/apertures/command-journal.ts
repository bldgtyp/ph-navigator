// Which aperture product commands may be written optimistically, and what
// applying one to the cached spec report looks like. Same rule as the envelope
// side — see `planning/archive/spec-status-batch-editing/decisions.md` D-1.
import { definedFieldPatch, patchesOnlyFields } from "../project_document/commandFieldPatch";
import { patchRowById } from "../project_document/sliceRowPatch";
import type { ApertureProductCommand, ApertureSpecReportResponse } from "./types";

export type JournaledApertureCommand = Extract<
  ApertureProductCommand,
  { kind: "update_project_glazing" | "update_project_frame" }
>;

/**
 * The glazing/frame fields whose server effect the client can reproduce
 * exactly. None is a catalog-override field
 * (`_PROJECT_GLAZING_OVERRIDE_FIELDS` / `_PROJECT_FRAME_OVERRIDE_FIELDS`,
 * backend), so a command carrying nothing else lands exactly where
 * `applyJournaledApertureCommand` puts it. The remove commands change which
 * rows exist and stay awaited.
 */
export const JOURNALED_PRODUCT_FIELDS = [
  "specification_status",
  "datasheet_not_required",
  "photo_not_required",
] as const;
const IDENTITY_KEYS = ["kind", "project_glazing_id", "project_frame_id"] as const;

/** True when `command` patches only journaled fields on one existing row. */
export function isJournaledApertureCommand(
  command: ApertureProductCommand,
): command is JournaledApertureCommand {
  return (
    (command.kind === "update_project_glazing" || command.kind === "update_project_frame") &&
    patchesOnlyFields(command, JOURNALED_PRODUCT_FIELDS, IDENTITY_KEYS)
  );
}

export function journaledApertureCommandRowId(command: JournaledApertureCommand): string {
  return command.kind === "update_project_glazing"
    ? command.project_glazing_id
    : command.project_frame_id;
}

/** Every glazing and frame id a journaled command could target. */
export function journaledApertureRowIds(slice: ApertureSpecReportResponse): ReadonlySet<string> {
  return new Set([
    ...slice.project_glazings.map((glazing) => glazing.id),
    ...slice.project_frames.map((frame) => frame.id),
  ]);
}

/** Apply a journaled command to a spec-report slice, exactly as the server will. */
export function applyJournaledApertureCommand(
  slice: ApertureSpecReportResponse,
  command: JournaledApertureCommand,
): ApertureSpecReportResponse {
  const patch = definedFieldPatch(command, JOURNALED_PRODUCT_FIELDS);
  const rowId = journaledApertureCommandRowId(command);
  if (command.kind === "update_project_glazing") {
    const project_glazings = patchRowById(slice.project_glazings, rowId, patch);
    return project_glazings ? { ...slice, project_glazings } : slice;
  }
  const project_frames = patchRowById(slice.project_frames, rowId, patch);
  return project_frames ? { ...slice, project_frames } : slice;
}
