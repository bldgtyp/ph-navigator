import type { ApertureTypeEntry } from "../types";

export function AperturesHeader({ activeAperture }: { activeAperture: ApertureTypeEntry | null }) {
  return (
    <header className="apertures-page__header">
      <h2>{activeAperture?.name ?? "Apertures"}</h2>
      <span className="uw-chip" title="Per-window U-Value (Phase 09 will fill this in).">
        Window U-Value: --
      </span>
    </header>
  );
}
