import { MoreHorizontal } from "lucide-react";
import { useUnitPreference } from "../../../lib/units";
import type { ApertureTypeEntry } from "../types";
import type { ApertureUValueResult } from "../hooks/useApertureUValues";
import { ExportHbjsonAction } from "./ExportHbjsonAction";
import { UValueChip } from "./UValueChip";

// Optional Phase-10 export wiring. Hidden for Viewers / projects with no
// active version; the export action is disabled when no apertures exist.
export type AperturesHeaderExportContext = {
  projectId: string;
  versionId: string;
  source: "draft" | "version";
  projectBtNumber: string;
  versionLabel: string;
  hasApertures: boolean;
  onError: (message: string) => void;
};

// Phase-11 overflow action: open the manufacturer-filters modal. The
// callback is wired from ``AperturesTab``; the header hides the entry
// when no callback is supplied (Viewers, or the tab is read-only).
export type AperturesHeaderFiltersContext = {
  onConfigureFilters: () => void;
};

export function AperturesHeader({
  activeAperture,
  uValue,
  loading = false,
  exportContext,
  filtersContext,
}: {
  activeAperture: ApertureTypeEntry | null;
  uValue?: ApertureUValueResult | null;
  loading?: boolean;
  exportContext?: AperturesHeaderExportContext;
  filtersContext?: AperturesHeaderFiltersContext;
}) {
  const { unitSystem } = useUnitPreference();
  return (
    <header className="apertures-page__header">
      <h2>{activeAperture?.name ?? "Apertures"}</h2>
      <UValueChip
        valueWm2k={uValue?.window_u_value_w_m2k ?? null}
        unitSystem={unitSystem === "IP" ? "ip" : "si"}
        unfinishedCount={uValue?.warnings.length ?? 0}
        loading={loading}
      />
      {exportContext || filtersContext ? (
        <details className="apertures-overflow">
          <summary
            className="apertures-overflow__trigger"
            aria-label="Aperture actions"
            title="Aperture actions"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </summary>
          <div className="apertures-overflow__menu" role="menu">
            {exportContext ? (
              <ExportHbjsonAction
                projectId={exportContext.projectId}
                versionId={exportContext.versionId}
                source={exportContext.source}
                projectBtNumber={exportContext.projectBtNumber}
                versionLabel={exportContext.versionLabel}
                disabled={!exportContext.hasApertures}
                onError={exportContext.onError}
              />
            ) : null}
            {filtersContext ? (
              <button
                type="button"
                className="apertures-overflow__item"
                onClick={filtersContext.onConfigureFilters}
              >
                Configure manufacturer filters
              </button>
            ) : null}
          </div>
        </details>
      ) : null}
    </header>
  );
}
