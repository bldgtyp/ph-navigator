import type { ProjectMaterialDriftItem, ProjectMaterialDriftState } from "./types";

export const MATERIAL_DRIFT_STATE_LABELS: Record<ProjectMaterialDriftState, string> = {
  in_sync: "In sync",
  customized: "Customized",
  drifted: "Catalog drift",
  source_deactivated: "Source deactivated",
  source_missing: "Source missing",
};

/**
 * "Needs review" means the shared catalog moved out from under the project
 * copy (or the source row vanished) — something the user has not decided on
 * yet. A deliberately `customized` material is NOT review-worthy: the user
 * already made that call, so it stays out of the banner count and carries no
 * alarm indicator. Use `materialHasCatalogAction` for "can this row open the
 * refresh dialog", which does include `customized`.
 */
export function materialNeedsCatalogReview(
  item: ProjectMaterialDriftItem | null | undefined,
): item is ProjectMaterialDriftItem {
  if (item === null || item === undefined) return false;
  return (
    item.state === "drifted" ||
    item.state === "source_deactivated" ||
    item.state === "source_missing"
  );
}

/** Any non-synced state has something the refresh dialog can act on. */
export function materialHasCatalogAction(
  item: ProjectMaterialDriftItem | null | undefined,
): item is ProjectMaterialDriftItem {
  return item !== null && item !== undefined && item.state !== "in_sync";
}

/** Both catalog-review banners, so the two never word the same count differently. */
export function materialReviewBannerLabel(count: number): string {
  return `${count} ${count === 1 ? "material needs" : "materials need"} catalog review`;
}

/** Fields the catalog changed — the number the review dialog asks about. */
function countDriftedFields(item: ProjectMaterialDriftItem): number {
  return item.fields.filter((field) => field.differs).length;
}

/** Fields the project deliberately overrides, ignoring ones that also drifted. */
function countOverriddenFields(item: ProjectMaterialDriftItem): number {
  return item.fields.filter((field) => field.is_overridden && !field.differs).length;
}

/**
 * Label for the single consolidated action on a material row. Names the state
 * *and* the work, so the row needs no separate badge beside the button.
 */
export function materialCatalogActionLabel(item: ProjectMaterialDriftItem): string {
  if (item.state === "source_missing") return "Catalog source missing";
  if (item.state === "source_deactivated") return "Catalog source retired";
  if (item.state === "customized") return "Customized — compare to catalog";
  const changed = countDriftedFields(item);
  return changed === 1 ? "Review 1 catalog change" : `Review ${changed} catalog changes`;
}

/** Tooltip for the collapsed-row indicator and the action button. */
export function materialCatalogActionHint(item: ProjectMaterialDriftItem): string {
  if (item.state === "source_missing") {
    return "The catalog material this copy came from no longer exists.";
  }
  if (item.state === "source_deactivated") {
    return "The catalog material this copy came from was deactivated.";
  }
  if (item.state === "customized") {
    const overrides = countOverriddenFields(item);
    return overrides === 1
      ? "1 field is a local override of the catalog value."
      : `${overrides} fields are local overrides of the catalog values.`;
  }
  const changed = countDriftedFields(item);
  return changed === 1
    ? "The shared catalog changed 1 value since this copy was made."
    : `The shared catalog changed ${changed} values since this copy was made.`;
}
