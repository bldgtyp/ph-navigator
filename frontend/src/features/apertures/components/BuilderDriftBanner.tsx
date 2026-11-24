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
  canEdit = true,
}: {
  apertureTypeId: string | null;
  apertureTypeName?: string | null;
  canEdit?: boolean;
}) {
  const allEntries = useAllReviewWorthyDriftEntries();
  const activeEntries = useApertureDriftEntries(apertureTypeId);
  const openRefresh = useOpenRefreshDialog();
  const [reviewOpen, setReviewOpen] = useState(false);

  if (allEntries.length === 0) return null;

  // Always show every entry counted in the banner, with active-aperture entries
  // prioritized first so the user sees the current aperture at the top.
  const otherEntries = allEntries.filter((entry) => entry.aperture_type_id !== apertureTypeId);
  const modalEntries = [...activeEntries, ...otherEntries];
  const modalTitle = "Catalog review — all apertures";
  const modalLede = apertureReviewBannerLabel(
    allEntries.length,
    activeEntries.length,
    apertureTypeName,
  );

  return (
    <>
      <div className="aperture-drift-banner" role="status">
        <span>{modalLede}</span>
        <button type="button" className="text-button" onClick={() => setReviewOpen(true)}>
          Review all
        </button>
      </div>
      {reviewOpen ? (
        <ApertureDriftEntriesModal
          title={modalTitle}
          lede={modalLede}
          entries={modalEntries}
          canEdit={canEdit}
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
