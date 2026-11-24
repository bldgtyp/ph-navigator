import { thermalComfortChipPresentation } from "../comfort-chip";
import type { ApertureThermalComfortResult } from "../comfort-types";

/**
 * Interactive Phius thermal-comfort status chip sitting beside `UValueChip` in
 * `AperturesHeader`. Mirrors Envelope's `CondensationChip` using existing
 * `.chip` tone classes.
 */
export function ThermalComfortChip({
  result,
  loading = false,
  unavailable = false,
  onClick,
}: {
  result: ApertureThermalComfortResult | null;
  loading?: boolean;
  unavailable?: boolean;
  onClick: () => void;
}) {
  const presentation = thermalComfortChipPresentation(result, loading, unavailable);
  const classes = [
    "chip",
    "chip--md",
    "chip--interactive",
    `chip--${presentation.tone}`,
    presentation.muted ? "chip--muted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      title="Open Phius window thermal-comfort screening details"
    >
      {presentation.label}
    </button>
  );
}
