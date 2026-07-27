import type { MaterialCategoryId } from "../catalogs/types";
import { materialColor } from "./lib";
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

/**
 * The stroke a membrane rule should paint, or `undefined` to defer to CSS.
 *
 * A material's colour is optional, and `materialColor` answers a missing one
 * with `transparent`. That is harmless for a filled rect but fatal for a rule:
 * the layer would occupy its band and stay selectable while drawing nothing.
 * Returning `undefined` lets the stylesheet's default stroke apply, which is
 * what guarantees a membrane is always visible.
 */
export function membraneStrokeColor(material: ProjectMaterial | null): string | undefined {
  return material?.color ? materialColor(material) : undefined;
}
