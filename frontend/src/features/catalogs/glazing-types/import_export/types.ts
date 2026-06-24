// Hand-maintained mirror of the backend's glazing-types import-file
// contracts. See `backend/features/catalogs/glazing_types/import_export/`
// — keep this in sync with that module's file_format / service models.

export const FILE_KIND = "ph-navigator.catalog.glazing-types" as const;
// v2 (window-glass-catalog-enums): single-select values fold to the canonical
// vocab on import, `name` is computed from the parts, and unknown values are
// auto-added to the option store. See backend `import_export/upgrade.py`.
export const CURRENT_SCHEMA_VERSION = 2;

export type CatalogFileRow = {
  id: string;
  name: string;
  manufacturer: string | null;
  brand: string | null;
  suffix: string | null;
  u_value_w_m2k: number | null;
  g_value: number | null;
  color: string | null;
  source: string | null;
  datasheet_url: string | null;
  comments: string | null;
};

export type CatalogFile = {
  kind: typeof FILE_KIND;
  schema_version: number;
  exported_at: string;
  exported_by: string | null;
  app_version: string | null;
  rows: CatalogFileRow[];
};

export type PreviewCounts = {
  new: number;
  matched: number;
  errored: number;
  warnings: number;
  // v2: rows dropped by the upgrade step (e.g. the legacy `DEFAULT` artifact).
  dropped: number;
};

export type PreviewWarning = {
  reason: string;
  count: number;
  row_indices: number[];
};

export type PreviewRow = {
  index: number;
  classification: "new" | "matched" | "errored";
  id: string | null;
  name: string | null;
  manufacturer: string | null;
};

export type PreviewResponse = {
  token: string;
  schema_version: number;
  counts: PreviewCounts;
  warnings: PreviewWarning[];
  errors: PreviewWarning[];
  rows_preview: PreviewRow[];
};

export type CommitResponse = {
  inserted: number;
  inserted_ids: string[];
  skipped_conflict_ids: string[];
};
