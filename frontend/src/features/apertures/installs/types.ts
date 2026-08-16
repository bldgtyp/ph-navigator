// Wire types for the `aperture_install_types` DataTable slice (the window
// install Ψ-value library). Mirrors
// backend/features/project_document/tables/aperture_install_types.py.
import type { TableFieldDef } from "../../../shared/ui/data-table";
import { APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY } from "../../../shared/ui/data-table/status";
import type { CustomValue, RowsComputed, SingleSelectOption } from "../../equipment/types";

export const APERTURE_INSTALL_TYPES_TABLE_NAME = "aperture_install_types";
export const APERTURE_INSTALL_DEFAULT_TYPE_ID = "apit_default";
export const APERTURE_INSTALL_SOURCE_KEY = "source";
export const APERTURE_INSTALL_SOURCE_OPTION_KEY = "aperture_install_types.source";
export const APERTURE_INSTALL_PDF_REPORT_FIELD_KEY = "pdf_report_asset_ids";
export const APERTURE_INSTALL_DATASHEET_FIELD_KEY = "datasheet_asset_ids";
export const APERTURE_INSTALL_PHOTO_FIELD_KEY = "photo_asset_ids";
export const APERTURE_INSTALL_OPTION_KEYS = [
  APERTURE_INSTALL_SOURCE_OPTION_KEY,
  APERTURE_INSTALL_TYPES_STATUS_OPTION_KEY,
] as const;

export type InstallTypeOptionKey = (typeof APERTURE_INSTALL_OPTION_KEYS)[number];

export type InstallTypeRow = {
  id: string;
  pdf_report_asset_ids: string[];
  datasheet_asset_ids: string[];
  photo_asset_ids: string[];
  notes: string | null;
  datasheet_not_required?: boolean;
  photo_not_required?: boolean;
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type InstallTypesOptionMap = Record<InstallTypeOptionKey, SingleSelectOption[]> & {
  [key: string]: SingleSelectOption[];
};

export type InstallTypesSlice = {
  project_id: string;
  version_id: string;
  source: "version" | "draft";
  version_etag: string;
  draft_etag: string | null;
  aperture_install_types: InstallTypeRow[];
  field_defs: TableFieldDef[];
  single_select_options: InstallTypesOptionMap;
  rows_computed?: RowsComputed;
};

export type InstallTypesReplacePayload = {
  aperture_install_types: InstallTypeRow[];
  field_defs?: TableFieldDef[];
  single_select_options: InstallTypesOptionMap;
};
