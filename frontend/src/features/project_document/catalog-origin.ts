export type CatalogTableName = "materials" | "frame_types" | "glazing_types";

export type CatalogOrigin = {
  catalog_table: CatalogTableName;
  catalog_record_id: string;
  catalog_version_id: string;
  catalog_schema_version: number;
  synced_at: string;
  local_overrides: string[];
};
