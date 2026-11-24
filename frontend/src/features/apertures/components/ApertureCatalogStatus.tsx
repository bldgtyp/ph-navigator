// Catalog-state affordances for aperture products (frames & glazings) and
// the shared ModalDialog entry-picker used when multiple drifted entries need
// review. Mirrors `envelope/components/MaterialCatalogStatus.tsx`.

import { AlertTriangle, RefreshCw } from "lucide-react";
import { ModalDialog } from "../../../shared/ui";
import {
  apertureCatalogActionHint,
  apertureCatalogActionLabel,
  apertureDriftEntrySummary,
  entriesHaveCriticalDrift,
  entriesNeedCatalogReview,
  entryNeedsCatalogReview,
  formatDriftTarget,
} from "../drift";
import type { ApertureDriftEntry } from "../drift-types";

/**
 * Collapsed-row flag rendered beside a frame or glazing name in the spec
 * report table. Only review-worthy states raise a flag — customized-only rows
 * stay quiet so alarm indicators remain trustworthy.
 */
export function ApertureDriftFlag({ entries }: { entries: readonly ApertureDriftEntry[] }) {
  if (!entriesNeedCatalogReview(entries)) return null;
  const critical = entriesHaveCriticalDrift(entries);
  const stateLabel = critical ? "Catalog source missing" : "Catalog drift";
  const label = `${stateLabel}. ${apertureCatalogActionHint(entries)}`;
  return (
    <span
      className={`drift-flag${critical ? " drift-flag--critical" : ""}`}
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
 * Single consolidated action at the top of an expanded frame/glazing row.
 * Carries both the state and the count-bearing action so the row never splits
 * a header badge from a bottom-column action list. Viewers get a read-only chip.
 */
export function ApertureCatalogAction({
  entries,
  canEdit,
  busy,
  onReview,
}: {
  entries: readonly ApertureDriftEntry[];
  canEdit: boolean;
  busy: boolean;
  onReview: () => void;
}) {
  if (entries.length === 0) return null;
  const needsReview = entriesNeedCatalogReview(entries);
  const critical = entriesHaveCriticalDrift(entries);
  const hint = apertureCatalogActionHint(entries);
  const label = apertureCatalogActionLabel(entries);

  if (!canEdit) {
    const toneClass = critical ? "source_missing" : needsReview ? "drifted" : "customized";
    return (
      <span className={`chip chip--sm material-drift-badge ${toneClass}`} title={hint}>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`drift-action ${needsReview ? "primary-button" : "secondary-button"}`}
      title={hint}
      disabled={busy}
      onClick={(event) => {
        event.stopPropagation();
        onReview();
      }}
    >
      {critical ? (
        <AlertTriangle size={14} aria-hidden="true" />
      ) : (
        <RefreshCw size={14} aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

/**
 * ModalDialog-backed list of drifted entries used both by `BuilderDriftBanner`
 * ("Review all") and by `ApertureSpecReportPanel` when a product has multiple
 * drifted use sites. Every entry — including `catalog_row_missing` — opens
 * `RefreshDialog` so there are no dead-end states.
 */
export function ApertureDriftEntriesModal({
  title,
  lede,
  entries,
  canEdit = true,
  onClose,
  onSelectEntry,
}: {
  title: string;
  lede: string;
  entries: readonly ApertureDriftEntry[];
  canEdit?: boolean;
  onClose: () => void;
  onSelectEntry: (entry: ApertureDriftEntry) => void;
}) {
  return (
    <ModalDialog
      title={title}
      titleId="aperture-drift-entries-title"
      onClose={onClose}
      showHeaderClose
      dismissOnBackdrop
      scrollBody
    >
      <div className="modal-form">
        <p className="modal-lede">{lede}</p>
        <ul className="drift-entry-list">
          {entries.map((entry) => {
            const needsReview = entryNeedsCatalogReview(entry);
            const inspectOnly = !canEdit || entry.kind === "catalog_row_missing";
            return (
              <li
                key={`${entry.aperture_type_id}:${entry.element_id}:${entry.target}`}
                className="drift-entry-list__item"
              >
                <div className="drift-entry-list__meta">
                  <strong>
                    {entry.aperture_type_name} · {entry.element_name}
                  </strong>
                  <span>
                    {formatDriftTarget(entry.target)} · {apertureDriftEntrySummary(entry)}
                  </span>
                </div>
                <button
                  type="button"
                  className={needsReview && !inspectOnly ? "primary-button" : "secondary-button"}
                  onClick={() => onSelectEntry(entry)}
                >
                  {inspectOnly ? "Inspect" : "Review"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </ModalDialog>
  );
}
