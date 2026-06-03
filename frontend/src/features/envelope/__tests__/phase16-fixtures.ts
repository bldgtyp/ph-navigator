import type {
  Assembly,
  EnvelopeReadResponse,
  ProjectMaterial,
  ProjectMaterialDriftReport,
} from "../types";

export const PHASE16_EDGE_ASSEMBLY_ID = "asm_phase16_edge";
export const PHASE16_EDGE_ASSEMBLY_NAME = "PHASE16-WALL-LONG-EDGE-CASE-ASSEMBLY";
export const PHASE16_BULK_ASSEMBLY_COUNT = 12;
export const PHASE16_BULK_LAYER_COUNT = 4;
export const PHASE16_BULK_SEGMENT_COUNT = 3;
export const PHASE16_BULK_MATERIAL_COUNT = 6;

const LONG_MATERIAL_ID = "pmat_phase16_long_name";
const UNUSED_MATERIAL_ID = "pmat_phase16_unused";
const MEMBRANE_LAYER_ID = "lyr_phase16_membrane";
const STRUCTURE_LAYER_ID = "lyr_phase16_structure";
const FINISH_LAYER_ID = "lyr_phase16_finish";
const SLIVER_SEGMENT_ID = "seg_phase16_sliver";
const STRUCTURAL_SEGMENT_ID = "seg_phase16_structural";
const CAVITY_SEGMENT_ID = "seg_phase16_cavity";
const FINISH_SEGMENT_ID = "seg_phase16_finish";
const SLIVER_NOTE = "Very narrow return at jamb condition.";
const STRUCTURAL_NOTE = "Stud bay condition.";
const MISSING_LAMBDA_NOTE = "Missing lambda is intentional for QA visibility.";

export function phase16EnvelopeFixture(
  projectId: string,
  versionId: string,
  options: { source?: "draft" | "version" } = {},
): EnvelopeReadResponse {
  const source = options.source ?? "draft";
  const assemblies = [edgeAssembly(), ...bulkAssemblies()];
  const projectMaterials = [...edgeMaterials(), ...bulkMaterials()];

  return {
    project_id: projectId,
    version_id: versionId,
    source,
    version_etag: "phase16-version-etag",
    draft_etag: source === "draft" ? "phase16-draft-etag" : null,
    assemblies,
    project_materials: projectMaterials,
  };
}

export function phase16DriftFixture(
  projectId: string,
  versionId: string,
): ProjectMaterialDriftReport {
  return {
    project_id: projectId,
    version_id: versionId,
    source: "version",
    version_etag: "phase16-version-etag",
    draft_etag: null,
    materials: [
      {
        project_material_id: LONG_MATERIAL_ID,
        state: "drifted",
        catalog_record_id: "mat_phase16_long_name",
        pinned_catalog_version_id: "matv_phase16_a",
        current_catalog_version_id: "matv_phase16_b",
        local_overrides: [],
        fields: [
          {
            key: "conductivity_w_mk",
            project_value: 0.037,
            catalog_value: 0.035,
            is_overridden: false,
            differs: true,
          },
        ],
      },
    ],
  };
}

function edgeAssembly(): Assembly {
  return {
    id: PHASE16_EDGE_ASSEMBLY_ID,
    name: PHASE16_EDGE_ASSEMBLY_NAME,
    type: "wall",
    orientation: "first_layer_outside",
    status: { is_complete: false, flags: ["missing_material", "missing_conductivity"] },
    layers: [
      {
        id: MEMBRANE_LAYER_ID,
        order: 0,
        thickness_mm: 3,
        segments: [
          {
            id: SLIVER_SEGMENT_ID,
            order: 0,
            width_mm: 12.7,
            is_continuous_insulation: true,
            steel_stud_spacing_mm: null,
            project_material_id: LONG_MATERIAL_ID,
            photo_asset_ids: ["asset_photo_1"],
            use_site_notes: SLIVER_NOTE,
          },
          {
            id: "seg_phase16_null",
            order: 1,
            width_mm: 38.1,
            is_continuous_insulation: false,
            steel_stud_spacing_mm: null,
            project_material_id: null,
            photo_asset_ids: [],
            use_site_notes: null,
          },
        ],
      },
      {
        id: STRUCTURE_LAYER_ID,
        order: 1,
        thickness_mm: 292.1,
        segments: [
          {
            id: STRUCTURAL_SEGMENT_ID,
            order: 0,
            width_mm: 406.4,
            is_continuous_insulation: false,
            steel_stud_spacing_mm: 406.4,
            project_material_id: "pmat_phase16_framing",
            photo_asset_ids: [],
            use_site_notes: STRUCTURAL_NOTE,
          },
          {
            id: CAVITY_SEGMENT_ID,
            order: 1,
            width_mm: 1219.2,
            is_continuous_insulation: false,
            steel_stud_spacing_mm: 406.4,
            project_material_id: "pmat_phase16_missing_lambda",
            photo_asset_ids: [],
            use_site_notes: MISSING_LAMBDA_NOTE,
          },
        ],
      },
      {
        id: FINISH_LAYER_ID,
        order: 2,
        thickness_mm: 12.7,
        segments: [
          {
            id: FINISH_SEGMENT_ID,
            order: 0,
            width_mm: 1676.4,
            is_continuous_insulation: false,
            steel_stud_spacing_mm: null,
            project_material_id: "pmat_phase16_finish",
            photo_asset_ids: [],
            use_site_notes: null,
          },
        ],
      },
    ],
  };
}

function edgeMaterials(): ProjectMaterial[] {
  return [
    {
      id: LONG_MATERIAL_ID,
      name: "Extremely long wood-fiber insulation product name used to test clipped labels",
      category: "Insulation",
      conductivity_w_mk: 0.037,
      density_kg_m3: 145,
      specific_heat_j_kgk: 2100,
      emissivity: 0.9,
      color: "#cee4cd",
      specification_status: "question",
      datasheet_asset_ids: ["asset_datasheet_1"],
      notes: "Long-name edge case for Phase 16 parity checks.",
      catalog_origin: {
        catalog_table: "materials",
        catalog_record_id: "mat_phase16_long_name",
        catalog_version_id: "matv_phase16_a",
        catalog_schema_version: 1,
        synced_at: "2026-05-27T21:30:00Z",
        local_overrides: [],
      },
      use_sites: [
        {
          assembly_id: PHASE16_EDGE_ASSEMBLY_ID,
          assembly_name: PHASE16_EDGE_ASSEMBLY_NAME,
          layer_id: MEMBRANE_LAYER_ID,
          layer_order: 0,
          segment_id: SLIVER_SEGMENT_ID,
          segment_order: 0,
          use_site_notes: SLIVER_NOTE,
          photo_asset_ids: ["asset_photo_1"],
        },
      ],
    },
    {
      id: "pmat_phase16_framing",
      name: "2x framing with thermal bridge allowance",
      category: "Structure",
      conductivity_w_mk: 0.12,
      density_kg_m3: 480,
      specific_heat_j_kgk: 1600,
      emissivity: null,
      color: "#b9a082",
      specification_status: "complete",
      datasheet_asset_ids: [],
      notes: null,
      catalog_origin: null,
      use_sites: [
        {
          assembly_id: PHASE16_EDGE_ASSEMBLY_ID,
          assembly_name: PHASE16_EDGE_ASSEMBLY_NAME,
          layer_id: STRUCTURE_LAYER_ID,
          layer_order: 1,
          segment_id: STRUCTURAL_SEGMENT_ID,
          segment_order: 0,
          use_site_notes: STRUCTURAL_NOTE,
          photo_asset_ids: [],
        },
      ],
    },
    {
      id: "pmat_phase16_missing_lambda",
      name: "Cavity insulation missing lambda",
      category: "Insulation",
      conductivity_w_mk: null,
      density_kg_m3: 32,
      specific_heat_j_kgk: null,
      emissivity: null,
      color: "#dcdcf5",
      specification_status: "missing",
      datasheet_asset_ids: [],
      notes: "Missing conductivity is intentional.",
      catalog_origin: null,
      use_sites: [
        {
          assembly_id: PHASE16_EDGE_ASSEMBLY_ID,
          assembly_name: PHASE16_EDGE_ASSEMBLY_NAME,
          layer_id: STRUCTURE_LAYER_ID,
          layer_order: 1,
          segment_id: CAVITY_SEGMENT_ID,
          segment_order: 1,
          use_site_notes: MISSING_LAMBDA_NOTE,
          photo_asset_ids: [],
        },
      ],
    },
    {
      id: "pmat_phase16_finish",
      name: "Gypsum board finish",
      category: "Finish",
      conductivity_w_mk: 0.16,
      density_kg_m3: 800,
      specific_heat_j_kgk: 1090,
      emissivity: 0.9,
      color: "#ebebe6",
      specification_status: "complete",
      datasheet_asset_ids: [],
      notes: null,
      catalog_origin: null,
      use_sites: [
        {
          assembly_id: PHASE16_EDGE_ASSEMBLY_ID,
          assembly_name: PHASE16_EDGE_ASSEMBLY_NAME,
          layer_id: FINISH_LAYER_ID,
          layer_order: 2,
          segment_id: FINISH_SEGMENT_ID,
          segment_order: 0,
          use_site_notes: null,
          photo_asset_ids: [],
        },
      ],
    },
    {
      id: UNUSED_MATERIAL_ID,
      name: "Unused QA-only membrane",
      category: "Membrane",
      conductivity_w_mk: null,
      density_kg_m3: null,
      specific_heat_j_kgk: null,
      emissivity: null,
      color: null,
      specification_status: "na",
      datasheet_asset_ids: [],
      notes: "Unused material verifies Specifications cleanup and viewer filtering.",
      catalog_origin: null,
      use_sites: [],
    },
  ];
}

function bulkAssemblies(): Assembly[] {
  return Array.from({ length: PHASE16_BULK_ASSEMBLY_COUNT }, (_, assemblyIndex) => ({
    id: `asm_phase16_bulk_${assemblyIndex + 1}`,
    name: `PHASE16-BULK-${String(assemblyIndex + 1).padStart(2, "0")}`,
    type: assemblyIndex % 3 === 0 ? "roof" : assemblyIndex % 3 === 1 ? "floor" : "wall",
    orientation: assemblyIndex % 2 === 0 ? "first_layer_outside" : "last_layer_outside",
    status: { is_complete: true, flags: [] },
    layers: Array.from({ length: PHASE16_BULK_LAYER_COUNT }, (_, layerIndex) => ({
      id: `lyr_phase16_bulk_${assemblyIndex + 1}_${layerIndex + 1}`,
      order: layerIndex,
      thickness_mm: 12.7 + layerIndex * 38.1,
      segments: Array.from({ length: PHASE16_BULK_SEGMENT_COUNT }, (_, segmentIndex) => ({
        id: `seg_phase16_bulk_${assemblyIndex + 1}_${layerIndex + 1}_${segmentIndex + 1}`,
        order: segmentIndex,
        width_mm: 304.8 + segmentIndex * 152.4,
        is_continuous_insulation: layerIndex === 0,
        steel_stud_spacing_mm: layerIndex === 2 ? 406.4 : null,
        project_material_id: `pmat_phase16_bulk_${
          (assemblyIndex + layerIndex + segmentIndex) % PHASE16_BULK_MATERIAL_COUNT
        }`,
        photo_asset_ids: [],
        use_site_notes: null,
      })),
    })),
  }));
}

function bulkMaterials(): ProjectMaterial[] {
  return Array.from({ length: PHASE16_BULK_MATERIAL_COUNT }, (_, index) => ({
    id: `pmat_phase16_bulk_${index}`,
    name: `Bulk fixture material ${index + 1}`,
    category: index % 2 === 0 ? "Insulation" : "Finish",
    conductivity_w_mk: 0.035 + index * 0.005,
    density_kg_m3: 90 + index * 25,
    specific_heat_j_kgk: 1000 + index * 100,
    emissivity: null,
    color: null,
    specification_status: "complete",
    datasheet_asset_ids: [],
    notes: null,
    catalog_origin: null,
    use_sites: [],
  }));
}
