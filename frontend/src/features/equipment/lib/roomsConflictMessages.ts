// User-facing copy for the three conflict states the Rooms slice can
// land in. Centralized so EquipmentTab + the modal-save helpers all
// pull from the same strings; future tabs (ERV, Pumps, Fans, TB)
// ship their own equivalents.

import type { ConflictMessages } from "../../../shared/ui/data-table/feature";

export const ROOMS_ACTIVE_ROW_CONFLICT_MESSAGE =
  "Rooms draft changed in another tab. Reload draft before saving this room.";
export const ROOMS_DELETE_CONFLICT_MESSAGE =
  "Rooms draft changed in another tab. Reload draft before deleting rooms.";
export const ROOMS_VERSION_LOCKED_MESSAGE =
  "This version was locked elsewhere. Local edits are preserved here; use Save As in the header or discard the draft.";

export const ROOMS_CONFLICT_MESSAGES: ConflictMessages = {
  activeRowConflict: ROOMS_ACTIVE_ROW_CONFLICT_MESSAGE,
  deleteConflict: ROOMS_DELETE_CONFLICT_MESSAGE,
  versionLocked: ROOMS_VERSION_LOCKED_MESSAGE,
};
