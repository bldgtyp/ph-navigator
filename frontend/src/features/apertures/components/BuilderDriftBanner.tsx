// Banner above the canvas summarizing review-worthy catalog drift across the
// project with an explicit active-aperture clause, mirroring EnvelopePage.
// Uses the shared ModalDialog contract via `ApertureDriftEntriesModal`.

import { useState } from "react";
import { apertureReviewBannerLabel } from "../drift";
import {
  useAllReviewWorthyDriftEntries,
  useApertureDriftEntries,
  useOpenRefreshDialog,
} from "../hooks/useDriftContext";
import { ApertureDriftEntriesModal } from "./ApertureCatalogStatus";

export function BuilderDriftBanner({
  apertureTypeId,
  apertureTypeName = null,
}: {
  apertureTypeId: string | null;
  apertureTypeName?: string | null;
}) {
  const allEntries = useAllReviewWorthyDriftEntries();
  const activeEntries = useApertureDriftEntries(apertureTypeId);
  const openRefresh = useOpenRefreshDialog();
  const [reviewOpen, setReviewOpen] = useState(false);

  if (allEntries.length === 0) return null;

  const modalEntries = activeEntries.length > 0 ? activeEntries : allEntries;
  const modalTitle =
    activeEntries.length > 0 && apertureTypeName
      ? `Catalog review — ${apertureTypeName}`
      : "Catalog review — all apertures";
  const modalLede =
    activeEntries.length > 0 && apertureTypeName
      ? `${activeEntries.length} ${activeEntries.length === 1 ? "entry needs" : "entries need"} catalog review on ${apertureTypeName}.`
      : `${allEntries.length} ${allEntries.length === 1 ? "entry needs" : "entries need"} catalog review across this project.`;

  return (
    <>
      <div className="aperture-drift-banner" role="status">
        <span>
          {apertureReviewBannerLabel(allEntries.length, activeEntries.length, apertureTypeName)}
        </span>
        <button type="button" className="text-button" onClick={() => setReviewOpen(true)}>
          Review all
        </button>
      </div>
      {reviewOpen ? (
        <ApertureDriftEntriesModal
          title={modalTitle}
          lede={modalLede}
          entries={modalEntries}
          onClose={() => setReviewOpen(false)}
          onSelectEntry={(entry) => {
            setReviewOpen(false);
            openRefresh?.(entry);
          }}
        />
      ) : null}
    </>
  );
}
