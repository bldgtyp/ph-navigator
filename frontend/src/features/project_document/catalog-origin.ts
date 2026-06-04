export type CatalogTableName = "materials" | "frame_types" | "glazing_types";

export type CatalogOrigin = {
  catalog_table: CatalogTableName;
  catalog_record_id: string;
  // Legacy fields from the per-version row layer; all v1 catalogs (materials,
  // glazing, frames) are now flat and always stamp null. Kept nullable so
  // older documents that still carry a stamped version id round-trip cleanly.
  catalog_version_id: string | null;
  catalog_schema_version: number | null;
  synced_at: string;
  local_overrides: string[];
};
