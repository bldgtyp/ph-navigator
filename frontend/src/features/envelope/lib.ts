import type { Assembly, AssemblyLayer, EnvelopeReadSource, ProjectMaterial } from "./types";
import type { ProjectDetail } from "../projects/types";
import { colorToCss } from "../../shared/lib/color";
import { naturalSortByName } from "../../shared/lib/sort";

export function naturalSortAssemblies(assemblies: Assembly[]): Assembly[] {
  return naturalSortByName(assemblies);
}

export function envelopeReadSource(project: ProjectDetail): EnvelopeReadSource {
  return project.access_mode === "viewer" || (project.active_version?.locked ?? false)
    ? "version"
    : "draft";
}

export function totalThicknessMm(assembly: Assembly): number {
  return assembly.layers.reduce((total, layer) => total + layer.thickness_mm, 0);
}

export function materialById(materials: ProjectMaterial[]): Map<string, ProjectMaterial> {
  return new Map(materials.map((material) => [material.id, material]));
}

export function layerWidthMm(layer: AssemblyLayer): number {
  return layer.segments.reduce((total, segment) => total + segment.width_mm, 0);
}

export function maxLayerWidthMm(assembly: Assembly): number {
  return Math.max(1, ...assembly.layers.map(layerWidthMm));
}

export function viewerVisibleMaterials(materials: ProjectMaterial[]): ProjectMaterial[] {
  return materials.filter(
    (material) => material.specification_status !== "na" && material.use_sites.length > 0,
  );
}

export function sortProjectMaterials(materials: ProjectMaterial[]): ProjectMaterial[] {
  return [...materials].sort((left, right) => {
    const leftPriority = materialSortPriority(left);
    const rightPriority = materialSortPriority(right);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
  });
}

function materialSortPriority(material: ProjectMaterial): number {
  if (material.use_sites.length === 0) return 3;
  if (material.specification_status === "complete") return 1;
  if (material.specification_status === "na") return 2;
  return 0;
}

export function statusLabel(flags: string[]): string {
  if (flags.length === 0) return "Thermal inputs complete";
  if (flags.includes("missing_material")) return "Missing material";
  if (flags.includes("missing_conductivity")) return "Missing lambda";
  if (flags.includes("invalid_geometry")) return "Invalid geometry";
  return "Needs review";
}

export function materialColor(material: ProjectMaterial | null): string {
  return colorToCss(material?.color);
}
