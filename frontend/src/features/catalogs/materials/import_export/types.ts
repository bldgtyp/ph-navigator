// Hand-maintained mirrors of the backend's CatalogFile / PreviewResponse
// / CommitResponse contracts (see
// `backend/features/catalogs/materials/import_export/`). Keep the field
// set in sync with the phase-02 plan's "What actually shipped" section;
// the frontend never invents fields.

import type { MaterialCategoryId } from "../../types";

export const FILE_KIND = "ph-navigator.catalog.materials" as const;
export const CURRENT_SCHEMA_VERSION = 1;

// Canonical row shape inside the file. `id` is the catalog row id
// (`rec` + 14 base62 chars) — exported alongside the values so a
// round-trip is dedup-able.
export type CatalogFileRow = {
  id: string;
  name: string;
  category: MaterialCategoryId;
  density_kg_m3: number | null;
  specific_heat_j_kgk: number | null;
  conductivity_w_mk: number | null;
  emissivity: number | null;
  color: string | null;
  source: string | null;
  url: string | null;
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
  category: string | null;
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
