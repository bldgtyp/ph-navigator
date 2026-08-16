// Render overlay + conflict messages for the Installs library table —
// the Thermal Bridges recipe with install-type columns. The attachment
// and status columns are locked; `source` is an app vocabulary (locked
// options). The Default row (`apit_default`) is delete-protected in
// payloads.ts client-side with the server 409 as authority.
import {
  ALL_FIELD_LOCKS,
  DEFAULT_BUILT_IN_LOCKS,
  RECORD_ID_FIELD_KEY,
  type TableFieldRenderOverlay,
} from "../../../shared/ui/data-table";
import {
  APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY,
  STATUS_DESCRIPTION,
  STATUS_DISPLAY_NAME,
  STATUS_FIELD_KEY,
} from "../../../shared/ui/data-table/status";
import {
  STATUS_AXIS_LABELS,
  STATUS_AXIS_TOOLTIPS,
} from "../../project_document/specification-status";
import {
  APERTURE_INSTALL_DATASHEET_FIELD_KEY,
  APERTURE_INSTALL_PDF_REPORT_FIELD_KEY,
  APERTURE_INSTALL_PHOTO_FIELD_KEY,
  APERTURE_INSTALL_SOURCE_KEY,
  APERTURE_INSTALL_SOURCE_OPTION_KEY,
  APERTURE_INSTALL_TYPES_TABLE_NAME,
  type InstallTypesSlice,
} from "./types";

export const INSTALL_TYPE_ID_PREFIX = "apit";

export { PDF_REPORT_ATTACHMENT_CONFIG } from "../../assets/lib";

export const INSTALL_TYPE_CUSTOM_VALUE_FIELD_KEYS = new Set([
  RECORD_ID_FIELD_KEY,
  "name",
  "psi_w_mk",
  APERTURE_INSTALL_SOURCE_KEY,
  STATUS_FIELD_KEY,
]);

export const INSTALL_TYPE_CONFLICT_MESSAGES = {
  activeRowConflict: "The Installs draft changed in another tab. Reload the draft before editing.",
  deleteConflict:
    "Could not delete install type. It may still be assigned to aperture edges, and the Default install type can never be deleted.",
  versionLocked: "This version is locked. Save As to copy it into a new version.",
};

export function installTypesFieldOverlay(
  slice: InstallTypesSlice,
): Record<string, TableFieldRenderOverlay> {
  return {
    [RECORD_ID_FIELD_KEY]: {
      locked: ["display_name", "delete", "duplicate"],
    },
    name: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    psi_w_mk: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [APERTURE_INSTALL_SOURCE_KEY]: {
      options: slice.single_select_options[APERTURE_INSTALL_SOURCE_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
    [APERTURE_INSTALL_PDF_REPORT_FIELD_KEY]: {
      locked: ALL_FIELD_LOCKS,
    },
    [APERTURE_INSTALL_DATASHEET_FIELD_KEY]: {
      description: STATUS_AXIS_TOOLTIPS.datasheet,
      display_name: STATUS_AXIS_LABELS.datasheet.column,
      locked: ALL_FIELD_LOCKS,
    },
    [APERTURE_INSTALL_PHOTO_FIELD_KEY]: {
      description: STATUS_AXIS_TOOLTIPS.photo,
      display_name: STATUS_AXIS_LABELS.photo.column,
      locked: ALL_FIELD_LOCKS,
    },
    notes: {
      locked: DEFAULT_BUILT_IN_LOCKS,
    },
    [STATUS_FIELD_KEY]: {
      description: STATUS_DESCRIPTION,
      display_name: STATUS_DISPLAY_NAME,
      options: slice.single_select_options[APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY],
      locked: ["field_type", "options", "delete", "duplicate"],
    },
  };
}

export function installTypeOptionListKeyForFieldKey(fieldKey: string): string | null {
  if (fieldKey === APERTURE_INSTALL_SOURCE_KEY) return APERTURE_INSTALL_SOURCE_OPTION_KEY;
  if (fieldKey.startsWith("cf_")) return `${APERTURE_INSTALL_TYPES_TABLE_NAME}.${fieldKey}`;
  return null;
}
