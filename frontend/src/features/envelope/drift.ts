import type { ProjectMaterialDriftItem, ProjectMaterialDriftState } from "./types";

export const MATERIAL_DRIFT_STATE_LABELS: Record<ProjectMaterialDriftState, string> = {
  in_sync: "In sync",
  customized: "Customized",
  drifted: "Catalog drift",
  source_deactivated: "Source deactivated",
  source_missing: "Source missing",
};

export function materialNeedsCatalogReview(
  item: ProjectMaterialDriftItem | null | undefined,
): item is ProjectMaterialDriftItem {
  return item !== null && item !== undefined && item.state !== "in_sync";
}
