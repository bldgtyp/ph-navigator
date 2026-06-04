/** Shared shape for versioned catalog rows (frame, glazing). Materials are
 * flat and do not extend this — see CatalogMaterial below.
 *
 * `created_by` / `updated_by` are intentionally NOT on this list-shape:
 * the catalog list endpoints trim them (see Catalog<X>ListItem in the
 * backend) so the wire payload stays small. The per-row detail endpoint
 * carries them on `Catalog<X>Detail`. No list UI displays them today. */
type CatalogRowBase = {
  id: string;
  name: string;
  current_version_id: string;
  catalog_schema_version: number;
  version_label: string;
  version_date: string;
  color: string | null;
  notes: string | null;
  source_provenance: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export const MATERIAL_CATEGORY_IDS = [
  "insulation",
  "finishes",
  "woods",
  "metals",
  "masonry",
  "stud_layers_steel",
  "stud_layers_wood",
  "air_horizontal_heat_flow",
  "air_upward_heat_flow",
  "air_downward_heat_flow",
  "rainscreen_insulation",
  "doors",
] as const;

export type MaterialCategoryId = (typeof MATERIAL_CATEGORY_IDS)[number];

// Shape returned by the materials list endpoint. Drops `created_by` /
// `updated_by` to trim wire payload (see backend `CatalogMaterialListItem`).
// The per-row detail endpoint returns `CatalogMaterialDetail` with the
// audit fields when needed.
export type CatalogMaterial = {
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
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CatalogMaterialDetail = CatalogMaterial & {
  created_by: string | null;
  updated_by: string | null;
};

export type CatalogMaterialListResponse = { items: CatalogMaterial[] };

export type CatalogMaterialCreatePayload = {
  name: string;
  category: MaterialCategoryId;
  density_kg_m3?: number | null;
  specific_heat_j_kgk?: number | null;
  conductivity_w_mk?: number | null;
  emissivity?: number | null;
  color?: string | null;
  source?: string | null;
  url?: string | null;
  comments?: string | null;
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
  color?: string | null;
  notes?: string | null;
  source_provenance?: string | null;
};

export type CatalogFrameTypeUpdatePayload = Partial<CatalogFrameTypeCreatePayload>;

export type CatalogGlazingType = {
  id: string;
  name: string;
  manufacturer: string | null;
  brand: string | null;
  suffix: string | null;
  u_value_w_m2k: number | null;
  g_value: number | null;
  color: string | null;
  source: string | null;
  comments: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CatalogGlazingTypeListResponse = { items: CatalogGlazingType[] };

export type CatalogGlazingTypeCreatePayload = {
  name: string;
  manufacturer?: string | null;
  brand?: string | null;
  suffix?: string | null;
  u_value_w_m2k?: number | null;
  g_value?: number | null;
  color?: string | null;
  source?: string | null;
  comments?: string | null;
};

export type CatalogGlazingTypeUpdatePayload = Partial<CatalogGlazingTypeCreatePayload>;
