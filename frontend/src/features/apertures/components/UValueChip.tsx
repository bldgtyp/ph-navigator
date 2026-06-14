// Composite U-Value chip shared by the Apertures-tab header
// (full-size, label-prefixed) and the per-element card (compact, no
// label). The chip is purely presentational; the parent computes the
// value from ``useApertureUValues`` and the project's unit system.
//
// Tooltip copy follows the PH-Nav-V1 effective window U-Value bubble.

import { InfoTooltip } from "../../../shared/ui/info-tooltip";
import { formatElementUValue, formatWindowUValue, type UValueUnitSystem } from "../format-u-value";

export const U_VALUE_TOOLTIP =
  "Effective Window U-Value (U-w). Calculated per ISO 10077-1:2006. " +
  "Uw = (Ag·Ug + Af·Uf + lg·Ψg) / Aw. Uninstalled value (excludes ψ-install).";

export type UValueChipProps = {
  valueWm2k: number | null | undefined;
  unitSystem: UValueUnitSystem;
  compact?: boolean;
  unfinishedCount?: number;
  loading?: boolean;
};

export function UValueChip({
  valueWm2k,
  unitSystem,
  compact = false,
  unfinishedCount = 0,
  loading = false,
}: UValueChipProps) {
  const text = loading
    ? "U-Value: --"
    : compact
      ? formatElementUValue(valueWm2k, unitSystem)
      : formatWindowUValue(valueWm2k, unitSystem);
  const fullValue = text.replace("Window U-Value: ", "").replace("U-Value: ", "");

  return (
    <span
      className={`aperture-uvalue-chip${compact ? " aperture-uvalue-chip--compact" : ""}`}
      data-testid="aperture-uvalue-chip"
    >
      {compact ? (
        fullValue
      ) : (
        <>
          <span className="aperture-uvalue-chip__label">U-Value</span>
          <span className="aperture-uvalue-chip__value">{fullValue}</span>
        </>
      )}
      <InfoTooltip label="Effective Window U-Value details">
        <strong>Effective Window U-Value (U-w)</strong>
        <span>Calculated per ISO 10077-1:2006</span>
        <span>
          <em>
            U<sub>w</sub> = (A<sub>g</sub>·U<sub>g</sub> + A<sub>f</sub>·U
            <sub>f</sub> + l<sub>g</sub>·Ψ<sub>g</sub>) / A<sub>w</sub>
          </em>
        </span>
        <span>Uninstalled value (excludes ψ-install)</span>
      </InfoTooltip>
      {unfinishedCount > 0 && <em className="aperture-uvalue-chip__unfinished"> (unfinished)</em>}
    </span>
  );
}
