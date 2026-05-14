/** Shared shape for every catalog row -- identity + version + audit fields. */
type CatalogRowBase = {
  id: string;
  name: string;
  current_version_id: string;
  catalog_schema_version: number;
  version_label: string;
  version_date: string;
  argb_color: string | null;
  notes: string | null;
  source_provenance: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

export type CatalogMaterial = CatalogRowBase & {
  category: string;
  conductivity_w_mk: number | null;
  density_kg_m3: number | null;
  specific_heat_j_kgk: number | null;
  emissivity: number | null;
};

export type CatalogMaterialListResponse = { items: CatalogMaterial[] };

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

export type CatalogFrameType = CatalogRowBase & {
  manufacturer: string | null;
  brand: string | null;
  width_mm: number | null;
  u_value_w_m2k: number | null;
  psi_g_w_mk: number | null;
  psi_install_w_mk: number | null;
};

export type CatalogFrameTypeListResponse = { items: CatalogFrameType[] };

export type CatalogFrameTypeCreatePayload = {
  name: string;
  manufacturer?: string | null;
  brand?: string | null;
  version_label?: string;
  version_date?: string | null;
  width_mm?: number | null;
  u_value_w_m2k?: number | null;
  psi_g_w_mk?: number | null;
  psi_install_w_mk?: number | null;
  argb_color?: string | null;
  notes?: string | null;
  source_provenance?: string | null;
};

export type CatalogFrameTypeUpdatePayload = Partial<CatalogFrameTypeCreatePayload>;

export type CatalogGlazingType = CatalogRowBase & {
  manufacturer: string | null;
  brand: string | null;
  u_value_w_m2k: number | null;
  g_value: number | null;
};

export type CatalogGlazingTypeListResponse = { items: CatalogGlazingType[] };

export type CatalogGlazingTypeCreatePayload = {
  name: string;
  manufacturer?: string | null;
  brand?: string | null;
  version_label?: string;
  version_date?: string | null;
  u_value_w_m2k?: number | null;
  g_value?: number | null;
  argb_color?: string | null;
  notes?: string | null;
  source_provenance?: string | null;
};

export type CatalogGlazingTypeUpdatePayload = Partial<CatalogGlazingTypeCreatePayload>;
