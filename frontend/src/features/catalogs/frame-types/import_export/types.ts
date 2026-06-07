// Hand-maintained mirror of the backend's frame-types import-file
// contracts. See `backend/features/catalogs/frame_types/import_export/`
// — keep this in sync with that module's file_format / service models.

export const FILE_KIND = "ph-navigator.catalog.frame-types" as const;
export const CURRENT_SCHEMA_VERSION = 1;

export type CatalogFileRow = {
  id: string;
  name: string;
  manufacturer: string | null;
  brand: string | null;
  use: string | null;
  operation: string | null;
  location: string | null;
  mull_type: string | null;
  prefix: string | null;
  suffix: string | null;
  material: string | null;
  width_mm: number | null;
  u_value_w_m2k: number | null;
  psi_g_w_mk: number | null;
  psi_install_w_mk: number | null;
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
