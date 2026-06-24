import type { BaseTableSlice } from "../project_document/table-slice";
import type { CatalogOrigin } from "../project_document/catalog-origin";

export type AssemblyType = "wall" | "floor" | "roof" | "other";
export type AssemblyOrientation = "first_layer_outside" | "last_layer_outside";

export type SpecificationStatus = "complete" | "missing" | "question" | "na";
export type ThermalStatusFlag =
  | "missing_material"
  | "missing_conductivity"
  | "invalid_geometry"
  | "broken_material_reference";
export type EnvelopeReadSource = "draft" | "version";

export type ProjectMaterialUseSite = {
  assembly_id: string;
  assembly_name: string;
  layer_id: string;
  layer_order: number;
  segment_id: string;
  segment_order: number;
  use_site_notes: string | null;
  photo_asset_ids: string[];
};

export type ProjectMaterial = {
  id: string;
  name: string;
  category: string | null;
  density_kg_m3: number | null;
  specific_heat_j_kgk: number | null;
  conductivity_w_mk: number | null;
  emissivity: number | null;
  color: string | null;
  source: string | null;
  url: string | null;
  comments: string | null;
  specification_status: SpecificationStatus;
  datasheet_asset_ids: string[];
  catalog_origin: CatalogOrigin | null;
  use_sites: ProjectMaterialUseSite[];
};

export type AssemblySegment = {
  id: string;
  order: number;
  width_mm: number;
  is_continuous_insulation: boolean;
  steel_stud_spacing_mm: number | null;
  project_material_id: string | null;
  photo_asset_ids: string[];
  use_site_notes: string | null;
};

export type AssemblyLayer = {
  id: string;
  order: number;
  thickness_mm: number;
  segments: AssemblySegment[];
};

export type Assembly = {
  id: string;
  name: string;
  type: AssemblyType;
  orientation: AssemblyOrientation;
  layers: AssemblyLayer[];
  status: {
    is_complete: boolean;
    flags: ThermalStatusFlag[];
  };
};

export type EnvelopeReadResponse = BaseTableSlice & {
  assemblies: Assembly[];
  project_materials: ProjectMaterial[];
};

export type AssemblyThermalResponse = {
  project_id: string;
  version_id: string;
  source: EnvelopeReadSource;
  assembly_id: string;
  input_hash: string;
  status: {
    is_complete: boolean;
    flags: ThermalStatusFlag[];
  };
  r_parallel_path_m2k_w: number | null;
  r_isothermal_planes_m2k_w: number | null;
  r_effective_m2k_w: number | null;
  u_effective_w_m2k: number | null;
  warnings: string[];
};

export type ProjectMaterialDriftState =
  | "in_sync"
  | "customized"
  | "drifted"
  | "source_deactivated"
  | "source_missing";

export type ProjectMaterialDriftFieldKey =
  | "name"
  | "category"
  | "density_kg_m3"
  | "specific_heat_j_kgk"
  | "conductivity_w_mk"
  | "emissivity"
  | "color"
  | "source"
  | "url"
  | "comments";

export type ProjectMaterialDriftField = {
  key: ProjectMaterialDriftFieldKey;
  project_value: unknown;
  catalog_value: unknown;
  is_overridden: boolean;
  differs: boolean;
};

export type ProjectMaterialDriftItem = {
  project_material_id: string;
  state: ProjectMaterialDriftState;
  catalog_record_id: string;
  local_overrides: string[];
  fields: ProjectMaterialDriftField[];
};

export type ProjectMaterialDriftReport = BaseTableSlice & {
  materials: ProjectMaterialDriftItem[];
};

export type ProjectMaterialRefreshChoice = {
  key: ProjectMaterialDriftFieldKey;
  action: "keep_mine" | "take_catalog" | "use_value";
  value?: unknown;
};

export type EnvelopeCommand =
  | {
      kind: "create_assembly";
      name: string;
      type: AssemblyType;
      orientation?: AssemblyOrientation;
      thickness_mm?: number;
      width_mm?: number;
    }
  | { kind: "rename_assembly"; assembly_id: string; name: string }
  | { kind: "update_assembly_type"; assembly_id: string; type: AssemblyType }
  | { kind: "duplicate_assembly"; assembly_id: string; name?: string | null }
  | { kind: "delete_assembly"; assembly_id: string }
  | {
      kind: "add_layer";
      assembly_id: string;
      target_layer_id?: string | null;
      position?: "above" | "below";
      thickness_mm?: number;
    }
  | { kind: "update_layer_thickness"; assembly_id: string; layer_id: string; thickness_mm: number }
  | { kind: "delete_layer"; assembly_id: string; layer_id: string }
  | {
      kind: "add_segment";
      assembly_id: string;
      layer_id: string;
      target_segment_id?: string | null;
      position?: "left" | "right";
      width_mm?: number;
    }
  | {
      kind: "update_segment";
      assembly_id: string;
      layer_id: string;
      segment_id: string;
      width_mm: number;
      is_continuous_insulation: boolean;
      steel_stud_spacing_mm: number | null;
    }
  | { kind: "delete_segment"; assembly_id: string; layer_id: string; segment_id: string }
  | { kind: "flip_orientation"; assembly_id: string }
  | { kind: "flip_layers"; assembly_id: string }
  | { kind: "flip_segments"; assembly_id: string }
  | {
      kind: "paste_assignment";
      assembly_id: string;
      layer_id: string;
      segment_id: string;
      project_material_id: string | null;
      is_continuous_insulation: boolean;
      steel_stud_spacing_mm: number | null;
    }
  | {
      kind: "pick_project_material";
      assembly_id: string;
      layer_id: string;
      segment_id: string;
      project_material_id: string | null;
    }
  | {
      kind: "pick_catalog_material";
      assembly_id: string;
      layer_id: string;
      segment_id: string;
      catalog_material_id: string;
    }
  | {
      kind: "hand_enter_material";
      assembly_id: string;
      layer_id: string;
      segment_id: string;
      name: string;
      category?: string;
      conductivity_w_mk?: number | null;
      density_kg_m3?: number | null;
      specific_heat_j_kgk?: number | null;
      emissivity?: number | null;
      color?: string | null;
    }
  | {
      kind: "update_project_material";
      project_material_id: string;
      name?: string | null;
      category?: string | null;
      density_kg_m3?: number | null;
      specific_heat_j_kgk?: number | null;
      conductivity_w_mk?: number | null;
      emissivity?: number | null;
      color?: string | null;
      source?: string | null;
      url?: string | null;
      comments?: string | null;
      specification_status?: SpecificationStatus | null;
    }
  | {
      kind: "update_segment_use_site_notes";
      assembly_id: string;
      layer_id: string;
      segment_id: string;
      use_site_notes: string | null;
    }
  | {
      kind: "detach_segment_material";
      assembly_id: string;
      layer_id: string;
      segment_id: string;
    }
  | { kind: "remove_unused_project_materials" }
  | { kind: "remove_project_material"; project_material_id: string }
  | {
      kind: "refresh_project_material_from_catalog";
      project_material_id: string;
      field_choices: ProjectMaterialRefreshChoice[];
    }
  | {
      kind: "import_envelope_constructions";
      file: Record<string, unknown>;
      resolutions: ConstructionResolution[];
      material_resolutions: MaterialResolution[];
    };

export type EnvelopeCommandBody = {
  command: EnvelopeCommand;
};

// --- HBJSON construction import (preview + apply) -------------------------

export type ConstructionImportAction = "add_new" | "replace" | "skip";

export type MaterialImportDecision =
  | "reuse_project_material"
  | "reuse_catalog_in_project"
  | "pick_from_catalog"
  | "create_new";

export type ConstructionResolution = {
  // The file's construction identifier — keys the override for native AND
  // foreign constructions (foreign carry no source assembly id).
  resolution_key: string;
  action: ConstructionImportAction;
  target_assembly_id?: string | null;
};

// The only material override: reject the auto-match and create a fresh copy.
export type MaterialResolution = {
  source_key: string;
  action: "create_new";
};

export type ImportConstructionPlanItem = {
  resolution_key: string;
  source_assembly_id: string | null;
  name: string;
  action: ConstructionImportAction;
  target_assembly_id: string | null;
  warnings: string[];
};

export type ImportMaterialPlanItem = {
  source_key: string;
  name: string;
  decision: MaterialImportDecision;
  project_material_id: string;
  catalog_record_id: string | null;
  warnings: string[];
};

export type ImportPlanCounts = {
  constructions_add: number;
  constructions_replace: number;
  constructions_skip: number;
  materials_reused: number;
  materials_picked_from_catalog: number;
  materials_created: number;
};

export type ImportConstructionsPreview = BaseTableSlice & {
  schema_version: number;
  constructions: ImportConstructionPlanItem[];
  materials: ImportMaterialPlanItem[];
  counts: ImportPlanCounts;
  warnings: string[];
};

export type EnvelopeAttachmentChangeArgs = {
  tableKey: string;
  rowId: string;
  fieldKey: string;
  currentAssetIds: string[];
  nextAssetIds: string[];
};

export type EnvelopeAttachmentChange =
  | EnvelopeAttachmentChangeArgs
  | EnvelopeAttachmentChangeArgs[];
