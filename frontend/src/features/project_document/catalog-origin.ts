export type CatalogTableName = "materials" | "frame_types" | "glazing_types";

export type CatalogOrigin = {
  catalog_table: CatalogTableName;
  catalog_record_id: string;
  // Null for the flat materials catalog (Alembic 20260603_0015).
  // Frame and glazing still carry both.
  catalog_version_id: string | null;
  catalog_schema_version: number | null;
  synced_at: string;
  local_overrides: string[];
};
