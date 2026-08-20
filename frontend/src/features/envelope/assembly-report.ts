import type { UnitSystem } from "../../lib/units";
import { buildAssemblyCanvasGeometry } from "./canvas-geometry";
import {
  assemblyMaterialsInFirstUseOrder,
  formatAssemblyLayerThickness,
  materialById,
  materialColor,
} from "./lib";
import {
  assemblyMaterialHeaders,
  formatAssemblyMaterialValues,
  type AssemblyMaterialHeader,
} from "./material-table-presentation";
import type { Assembly, AssemblyFace, ProjectMaterial } from "./types";

export type AssemblyReportMaterial = {
  project_material_id: string;
  name: string;
  color: string;
  value_label: string;
  density_label: string;
  specific_heat_label: string;
  emissivity_label: string;
};

export type AssemblyReportPageProjection = {
  assembly_id: string;
  name: string;
  assembly_type: Assembly["type"];
  orientation_top: "Exterior" | "Interior";
  orientation_bottom: "Exterior" | "Interior";
  width_mm: number;
  height_mm: number;
  needs_review_missing_material_data: boolean;
  material_headers: AssemblyMaterialHeader[];
  air_barrier: {
    layer_id: string;
    face: AssemblyFace;
    y_mm: number;
    width_mm: number;
  } | null;
  layers: Array<{
    layer_id: string;
    order: number;
    y_mm: number;
    height_mm: number;
    thickness_mm: number;
    thickness_label: string | null;
    is_membrane: boolean;
    segments: Array<{
      segment_id: string;
      x_mm: number;
      y_mm: number;
      width_mm: number;
      height_mm: number;
      project_material_id: string | null;
      material_name: string | null;
      color: string;
      is_missing_material: boolean;
      is_air_barrier: boolean;
    }>;
  }>;
  materials: AssemblyReportMaterial[];
};

export function buildAssemblyReportPage(
  assembly: Assembly,
  materials: ProjectMaterial[],
  units: UnitSystem,
): AssemblyReportPageProjection {
  const materialsById = materialById(materials);
  const geometry = buildAssemblyCanvasGeometry(assembly, materialsById);
  const usedMaterials = assemblyMaterialsInFirstUseOrder(assembly, materialsById);
  const segmentsByLayerId = new Map<string, typeof geometry.segments>();
  for (const segment of geometry.segments) {
    const entries = segmentsByLayerId.get(segment.layer.id) ?? [];
    entries.push(segment);
    segmentsByLayerId.set(segment.layer.id, entries);
  }
  let missingMaterial = false;

  const layers = geometry.layers.map((layerGeometry) => ({
    layer_id: layerGeometry.layer.id,
    order: layerGeometry.layer.order,
    y_mm: layerGeometry.yMm,
    height_mm: layerGeometry.heightMm,
    thickness_mm: layerGeometry.layer.thickness_mm,
    thickness_label: layerGeometry.isMembrane
      ? null
      : formatAssemblyLayerThickness(layerGeometry.layer.thickness_mm, units),
    is_membrane: layerGeometry.isMembrane,
    segments: (segmentsByLayerId.get(layerGeometry.layer.id) ?? []).map((segmentGeometry) => {
      const materialId = segmentGeometry.segment.project_material_id;
      const material = materialId ? (materialsById.get(materialId) ?? null) : null;
      if (material === null) missingMaterial = true;
      return {
        segment_id: segmentGeometry.segment.id,
        x_mm: segmentGeometry.xMm,
        y_mm: segmentGeometry.yMm,
        width_mm: segmentGeometry.widthMm,
        height_mm: segmentGeometry.heightMm,
        project_material_id: materialId,
        material_name: material?.name ?? null,
        color: materialColor(material),
        is_missing_material: material === null,
        is_air_barrier: segmentGeometry.isAirBarrier,
      };
    }),
  }));
  const exteriorAtTop = assembly.orientation === "first_layer_outside";

  return {
    assembly_id: assembly.id,
    name: assembly.name,
    assembly_type: assembly.type,
    orientation_top: exteriorAtTop ? "Exterior" : "Interior",
    orientation_bottom: exteriorAtTop ? "Interior" : "Exterior",
    width_mm: geometry.widthMm,
    height_mm: geometry.heightMm,
    needs_review_missing_material_data:
      missingMaterial || usedMaterials.some((material) => material.conductivity_w_mk === null),
    material_headers: assemblyMaterialHeaders(units),
    air_barrier: geometry.airBarrier
      ? {
          layer_id: geometry.airBarrier.layerId,
          face: geometry.airBarrier.face,
          y_mm: geometry.airBarrier.yMm,
          width_mm: geometry.airBarrier.widthMm,
        }
      : null,
    layers,
    materials: usedMaterials.map((material) => materialRow(material, units)),
  };
}

function materialRow(material: ProjectMaterial, units: UnitSystem): AssemblyReportMaterial {
  const labels = formatAssemblyMaterialValues(material, units, "—");
  return {
    project_material_id: material.id,
    name: material.name,
    color: materialColor(material),
    value_label: labels.valueLabel,
    density_label: labels.densityLabel,
    specific_heat_label: labels.specificHeatLabel,
    emissivity_label: labels.emissivityLabel,
  };
}
