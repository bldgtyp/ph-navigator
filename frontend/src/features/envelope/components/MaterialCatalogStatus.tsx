// Catalog-state affordances for a project material row: the collapsed-row
// flag (the only signal visible without expanding) and the single consolidated
// row action that replaced the old badge-left / outline-button-right pair.
import { AlertTriangle, RefreshCw } from "lucide-react";
import {
  MATERIAL_DRIFT_STATE_LABELS,
  materialCatalogActionHint,
  materialCatalogActionLabel,
  materialHasCatalogAction,
  materialNeedsCatalogReview,
  materialReviewBannerLabel,
} from "../drift";
import type { ProjectMaterialDriftItem } from "../types";

/**
 * Collapsed-row flag. Only review-worthy states get one — a deliberately
 * `customized` material is not a problem and must not raise an alarm on a
 * row the user already settled.
 */
export function MaterialDriftFlag({ item }: { item: ProjectMaterialDriftItem | null }) {
  if (!materialNeedsCatalogReview(item)) return null;
  const critical = item.state !== "drifted";
  const label = `${MATERIAL_DRIFT_STATE_LABELS[item.state]}. ${materialCatalogActionHint(item)}`;
  return (
    <span
      className={`material-drift-flag${critical ? " material-drift-flag--critical" : ""}`}
      title={label}
      aria-label={label}
      role="img"
    >
      {critical ? (
        <AlertTriangle size={12} aria-hidden="true" />
      ) : (
        <RefreshCw size={12} aria-hidden="true" />
      )}
    </span>
  );
}

/**
 * Materials-tab banner. The count is the whole point — it is the number the
 * Assemblies-tab banner promised when it sent the user here — and its action
 * narrows the table instead of navigating away.
 */
export function MaterialReviewBanner({
  count,
  filtered,
  onToggleFilter,
}: {
  count: number;
  filtered: boolean;
  onToggleFilter: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="envelope-command-banner" role="status">
      <span>{materialReviewBannerLabel(count)}.</span>
      <button
        type="button"
        className="text-button"
        aria-pressed={filtered}
        onClick={onToggleFilter}
      >
        {filtered ? "Show all materials" : "Show only these"}
      </button>
    </div>
  );
}

/**
 * One element carries both the state and the action, so the expansion header
 * no longer splits "what is wrong" from "what to do about it" across the full
 * width of the row. Viewers (and locked versions) get the read-only chip.
 */
export function MaterialCatalogAction({
  item,
  canEdit,
  busy,
  onReview,
}: {
  item: ProjectMaterialDriftItem | null;
  canEdit: boolean;
  busy: boolean;
  onReview: () => void;
}) {
  if (!materialHasCatalogAction(item)) return null;
  const hint = materialCatalogActionHint(item);
  if (!canEdit) {
    return (
      <span className={`chip chip--sm material-drift-badge ${item.state}`} title={hint}>
        {MATERIAL_DRIFT_STATE_LABELS[item.state]}
      </span>
    );
  }
  const needsReview = materialNeedsCatalogReview(item);
  return (
    <button
      type="button"
      className={`material-drift-action ${needsReview ? "primary-button" : "secondary-button"}`}
      title={hint}
      disabled={busy}
      onClick={onReview}
    >
      <RefreshCw size={14} aria-hidden="true" />
      {materialCatalogActionLabel(item)}
    </button>
  );
}
