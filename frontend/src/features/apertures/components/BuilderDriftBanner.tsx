// Phase 12 — banner above the canvas summarising drifted entries on
// the active aperture. ``Review all`` opens a per-entry list with a
// Refresh button per row that re-uses the same RefreshDialog. Hidden
// when there is no drift on the active aperture.

import { useState } from "react";
import type { ApertureDriftEntry } from "../drift-types";
import { useApertureDriftEntries, useOpenRefreshDialog } from "../hooks/useDriftContext";

export function BuilderDriftBanner({ apertureTypeId }: { apertureTypeId: string | null }) {
  const entries = useApertureDriftEntries(apertureTypeId);
  const openRefresh = useOpenRefreshDialog();
  const [reviewOpen, setReviewOpen] = useState(false);

  if (entries.length === 0) return null;

  return (
    <>
      <div className="aperture-drift-banner" role="status">
        <span>
          {entries.length} entr{entries.length === 1 ? "y" : "ies"} drifted from catalog
        </span>
        <button type="button" onClick={() => setReviewOpen(true)}>
          Review all
        </button>
      </div>
      {reviewOpen ? (
        <ReviewAllModal
          entries={entries}
          onClose={() => setReviewOpen(false)}
          onRefresh={(entry) => {
            setReviewOpen(false);
            openRefresh?.(entry);
          }}
        />
      ) : null}
    </>
  );
}

function ReviewAllModal({
  entries,
  onClose,
  onRefresh,
}: {
  entries: ApertureDriftEntry[];
  onClose: () => void;
  onRefresh: (entry: ApertureDriftEntry) => void;
}) {
  return (
    <div className="aperture-drift-modal__backdrop" role="presentation" onClick={onClose}>
      <div
        className="aperture-drift-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Drifted entries"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="aperture-drift-modal__header">
          <h2>Drifted entries</h2>
        </header>
        <ul className="aperture-drift-modal__list">
          {entries.map((entry) => (
            <li key={`${entry.element_id}:${entry.target}`}>
              <span>
                <strong>{entry.element_name}</strong> · {entry.target} ·{" "}
                {entry.kind === "catalog_row_missing"
                  ? "catalog row removed"
                  : `${entry.deltas.length} field${entry.deltas.length === 1 ? "" : "s"} differ`}
              </span>
              <button type="button" onClick={() => onRefresh(entry)}>
                Refresh
              </button>
            </li>
          ))}
        </ul>
        <footer className="aperture-drift-modal__footer">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
