// Composite U-Value chip shared by the Apertures-tab header
// (full-size, label-prefixed) and the per-element card (compact, no
// label). The chip is purely presentational; the parent computes the
// value from ``useApertureUValues`` and the project's unit system.
//
// PRD §8 tooltip text is the canonical no-films / no-operation
// reminder. Keep it verbatim so the in-app copy matches the docs.

import { formatElementUValue, formatWindowUValue, type UValueUnitSystem } from "../format-u-value";

export const U_VALUE_TOOLTIP =
  "Composite window U-Value per ISO 10077-1:2006. Excludes surface films and operation (sash type / direction). " +
  "Frames, glazing, and edge spacer (Ψg) contributions are included; psi_install is excluded — that's the " +
  "installation thermal-bridge, accounted separately.";

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
    ? compact
      ? "U-Value: --"
      : "Window U-Value: --"
    : compact
      ? formatElementUValue(valueWm2k, unitSystem)
      : formatWindowUValue(valueWm2k, unitSystem);

  const tooltip =
    unfinishedCount > 0
      ? `${U_VALUE_TOOLTIP}\n\n${unfinishedCount} element${unfinishedCount === 1 ? "" : "s"} ` +
        "missing a frame or glazing assignment. The value above is computed from the picked " +
        "elements only."
      : U_VALUE_TOOLTIP;

  return (
    <span
      className={`aperture-uvalue-chip${compact ? " aperture-uvalue-chip--compact" : ""}`}
      data-testid="aperture-uvalue-chip"
      title={tooltip}
    >
      {text}
      {unfinishedCount > 0 && <em className="aperture-uvalue-chip__unfinished"> (unfinished)</em>}
    </span>
  );
}
