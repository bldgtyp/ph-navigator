import type { BaseTableSlice } from "../project_document/table-slice";
import type { FieldOption, TableFieldDef } from "../../shared/ui/data-table";

export const SPACE_TYPES_TABLE_NAME = "space_types";
export const SPACE_TYPES_TARGET_TABLE_PATH = [SPACE_TYPES_TABLE_NAME] as const;
export const SPACE_TYPE_ID_PREFIX = "st";
export const SPACE_TYPE_NAME_FIELD_KEY = "name";

export type CustomValue = string | number | boolean | null;

export type SpaceTypeRow = {
  id: string;
  custom_values: Record<string, CustomValue>;
  custom_links?: Record<string, string[]>;
};

export type InverseLinks = Record<string, Record<string, string[]>>;

export type InverseLinkField = {
  source_key: string;
  source_table_path: string[];
  source_table_display: string;
  source_field_key: string;
  source_field_display_name: string;
};

export type SpaceTypesSlice = BaseTableSlice & {
  space_types: SpaceTypeRow[];
  field_defs: TableFieldDef[];
  single_select_options: Record<string, FieldOption[]>;
  rows_computed: Record<string, Record<string, unknown>>;
  inverse_links: InverseLinks;
  inverse_link_fields: InverseLinkField[];
  inverse_links_fingerprint: string;
};

export type SpaceTypesReplacePayload = {
  space_types: SpaceTypeRow[];
  field_defs: TableFieldDef[];
  single_select_options: Record<string, FieldOption[]>;
};
