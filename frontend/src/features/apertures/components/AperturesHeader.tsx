import { useUnitPreference } from "../../../lib/units";
import type { ApertureTypeEntry } from "../types";
import type { ApertureUValueResult } from "../hooks/useApertureUValues";
import { UValueChip } from "./UValueChip";

export function AperturesHeader({
  activeAperture,
  uValue,
  loading = false,
}: {
  activeAperture: ApertureTypeEntry | null;
  uValue?: ApertureUValueResult | null;
  loading?: boolean;
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
    </header>
  );
}
