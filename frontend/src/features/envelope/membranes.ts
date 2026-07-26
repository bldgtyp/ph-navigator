import type { MaterialCategoryId } from "../catalogs/types";
import type { AssemblyLayer, ProjectMaterial } from "./types";

// Mirrors the backend `MEMBRANE_CATEGORY_ID`
// (`backend/features/catalogs/materials/models.py`). The backend owns every
// consequence of being a membrane — the R exclusion, the single-segment rule.
// The frontend derives it only for display: how the layer is drawn and which
// affordances it offers.
// Typed against the catalog's own id union, so removing or renaming the
// category upstream is a compile error here rather than a predicate that
// silently stops matching.
export const MEMBRANE_CATEGORY_ID: MaterialCategoryId = "membrane";

export function isMembraneMaterial(material: ProjectMaterial | null | undefined): boolean {
  // `category` is a free string on project materials, so compare the way the
  // backend does — case- and whitespace-insensitively.
  return material?.category?.trim().toLowerCase() === MEMBRANE_CATEGORY_ID;
}

// Every assigned segment must be a membrane, matching backend
// `membranes.is_membrane_layer`. A layer mixing a membrane with a real
// material draws to scale like any other layer.
export function isMembraneLayer(
  layer: AssemblyLayer,
  materialsById: ReadonlyMap<string, ProjectMaterial>,
): boolean {
  const assigned = layer.segments
    .map((segment) =>
      segment.project_material_id ? (materialsById.get(segment.project_material_id) ?? null) : null,
    )
    .filter((material): material is ProjectMaterial => material !== null);
  return assigned.length > 0 && assigned.every(isMembraneMaterial);
}
