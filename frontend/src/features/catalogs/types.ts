export type CatalogMaterial = {
  id: string;
  name: string;
  category: string;
  current_version_id: string;
  catalog_schema_version: number;
  version_label: string;
  version_date: string;
  conductivity_w_mk: number | null;
  density_kg_m3: number | null;
  specific_heat_j_kgk: number | null;
  emissivity: number | null;
  argb_color: string | null;
  notes: string | null;
  source_provenance: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type CatalogMaterialListResponse = {
  items: CatalogMaterial[];
};

export type CatalogMaterialCreatePayload = {
  name: string;
  category: string;
  version_label?: string;
  version_date?: string | null;
  conductivity_w_mk?: number | null;
  density_kg_m3?: number | null;
  specific_heat_j_kgk?: number | null;
  emissivity?: number | null;
  argb_color?: string | null;
  notes?: string | null;
  source_provenance?: string | null;
};

export type CatalogMaterialUpdatePayload = Partial<CatalogMaterialCreatePayload>;
