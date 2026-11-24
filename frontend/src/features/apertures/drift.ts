import type { ApertureDriftEntry, DriftTarget } from "./drift-types";

const TARGET_LABELS: Record<DriftTarget, string> = {
  "frame.top": "Top frame",
  "frame.right": "Right frame",
  "frame.bottom": "Bottom frame",
  "frame.left": "Left frame",
  glazing: "Glazing",
};

/**
 * "Needs review" means the shared catalog moved out from under at least one
 * non-overridden field, or the catalog row was removed/deactivated. An entry
 * whose every differing field is in `in_local_overrides` represents deliberate
 * user customization — it stays out of alarm counts and collapsed-row flags,
 * while still offering a secondary "Customized — compare to catalog" action.
 */
export function entryNeedsCatalogReview(entry: ApertureDriftEntry): boolean {
  if (entry.kind === "catalog_row_missing") return true;
  return entry.deltas.some((delta) => !delta.in_local_overrides);
}

/** Every delta on this entry is a deliberate local override. */
export function entryIsCustomizedOnly(entry: ApertureDriftEntry): boolean {
  return (
    entry.kind === "field_delta" &&
    entry.deltas.length > 0 &&
    entry.deltas.every((delta) => delta.in_local_overrides)
  );
}

export function entriesNeedCatalogReview(entries: readonly ApertureDriftEntry[]): boolean {
  return entries.some(entryNeedsCatalogReview);
}

export function entriesHaveCriticalDrift(entries: readonly ApertureDriftEntry[]): boolean {
  return entries.some((entry) => entry.kind === "catalog_row_missing");
}

export function formatDriftTarget(target: DriftTarget): string {
  return TARGET_LABELS[target];
}

export function apertureDriftEntrySummary(entry: ApertureDriftEntry): string {
  if (entry.kind === "catalog_row_missing") return "Catalog row removed";
  const driftedCount = entry.deltas.filter((d) => !d.in_local_overrides).length;
  if (driftedCount === 0) {
    const n = entry.deltas.length;
    return n === 1 ? "1 local override" : `${n} local overrides`;
  }
  return driftedCount === 1 ? "1 catalog change" : `${driftedCount} catalog changes`;
}

/**
 * Label for the single consolidated action at the top of an expanded product
 * row. Aggregates honestly across drifted use-site entries.
 */
export function apertureCatalogActionLabel(entries: readonly ApertureDriftEntry[]): string {
  if (entries.length === 0) return "";
  const reviewEntries = entries.filter(entryNeedsCatalogReview);
  if (reviewEntries.length === 0) {
    return "Customized — compare to catalog";
  }
  const missingEntries = reviewEntries.filter((entry) => entry.kind === "catalog_row_missing");
  if (missingEntries.length === reviewEntries.length) {
    return missingEntries.length === 1
      ? "Catalog source missing"
      : `${missingEntries.length} catalog sources missing`;
  }
  const totalChanges = reviewEntries.reduce(
    (sum, entry) =>
      sum +
      (entry.kind === "catalog_row_missing"
        ? 1
        : entry.deltas.filter((delta) => !delta.in_local_overrides).length),
    0,
  );
  const distinctElements = new Set(reviewEntries.map((entry) => entry.element_id)).size;
  const changePhrase =
    totalChanges === 1 ? "Review 1 catalog change" : `Review ${totalChanges} catalog changes`;
  if (distinctElements > 1) {
    return `${changePhrase} across ${distinctElements} elements`;
  }
  return changePhrase;
}

/** Tooltip for the collapsed-row indicator and the consolidated row action. */
export function apertureCatalogActionHint(entries: readonly ApertureDriftEntry[]): string {
  if (entries.length === 0) return "";
  const missing = entries.filter((entry) => entry.kind === "catalog_row_missing");
  if (missing.length > 0 && missing.length === entries.length) {
    return "The catalog record this copy came from no longer exists or was deactivated.";
  }
  const reviewEntries = entries.filter(entryNeedsCatalogReview);
  if (reviewEntries.length === 0) {
    const overrides = entries.reduce((sum, entry) => sum + entry.deltas.length, 0);
    return overrides === 1
      ? "1 field is a local override of the catalog value."
      : `${overrides} fields are local overrides of the catalog values.`;
  }
  const totalChanges = reviewEntries.reduce(
    (sum, entry) =>
      sum +
      (entry.kind === "catalog_row_missing"
        ? 1
        : entry.deltas.filter((delta) => !delta.in_local_overrides).length),
    0,
  );
  const distinctElements = new Set(reviewEntries.map((entry) => entry.element_id)).size;
  const base =
    totalChanges === 1
      ? "The shared catalog changed 1 value"
      : `The shared catalog changed ${totalChanges} values`;
  if (distinctElements > 1) {
    return `${base} across ${distinctElements} elements.`;
  }
  return `${base} since this copy was made.`;
}

/**
 * Honest project-wide + active-aperture banner label, mirroring EnvelopePage's
 * project-level headline + active-scope clause.
 */
export function apertureReviewBannerLabel(
  projectCount: number,
  activeCount: number,
  activeApertureName: string | null,
): string {
  const headline = `${projectCount} catalog ${projectCount === 1 ? "entry needs" : "entries need"} review`;
  if (!activeApertureName) return `${headline}.`;
  if (activeCount === 0) {
    return `${headline} on other apertures.`;
  }
  if (activeCount === projectCount) {
    return `${headline} on ${activeApertureName}.`;
  }
  return `${headline} (${activeCount} on ${activeApertureName}).`;
}
