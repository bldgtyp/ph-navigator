import { climateSourceBadgeVersion, climateSourceKindLabel, type ClimateStatusTone } from "../lib";
import type { ProjectClimateSource } from "../types";

// Per-type colour badge (Phius / PHI / ASHRAE / EPW / Custom). Composes the
// shared `.chip .chip--sm` primitive; colour comes from `data-kind`.
export function ClimateTypeBadge({ source }: { source: ProjectClimateSource }) {
  const version = climateSourceBadgeVersion(source);
  return (
    <span className="chip chip--sm climate-type-badge" data-kind={source.kind}>
      {climateSourceKindLabel(source.kind)}
      {version ? ` ${version}` : null}
    </span>
  );
}

// OK / Check / Fail certification chip with a leading LED dot. Composes the
// shared `.chip .chip--sm` primitive.
export function ClimateStatusChip({ tone, label }: { tone: ClimateStatusTone; label: string }) {
  return (
    <span className={`chip chip--sm climate-status-chip climate-status-${tone}`}>
      <span className="led" aria-hidden="true" />
      {label}
    </span>
  );
}

// The privacy marker shown wherever the project location is presented. Coarse
// location is public; the spelled-out address is editor-only (D-CL-13), so the
// marker advertises that the address is withheld. Callers gate on `is_set`.
export function LocationPrivacyTag() {
  return <span className="climate-privacy-tag">private</span>;
}
