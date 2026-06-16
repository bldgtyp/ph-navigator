export type CustomValue = string | number | boolean | null;

export type InverseLinks = Record<string, Record<string, string[]>>;

export type RowsComputed = Record<string, Record<string, unknown>>;

export type InverseLinkField = {
  source_key: string;
  source_table_path: string[];
  source_table_display: string;
  source_field_key: string;
  source_field_display_name: string;
};
