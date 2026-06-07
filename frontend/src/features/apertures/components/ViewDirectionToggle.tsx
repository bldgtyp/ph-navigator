import { FlipHorizontal2 } from "lucide-react";
import type { ApertureViewDirection } from "./ApertureSvgCanvas";

export function ViewDirectionToggle({
  viewDirection,
  onToggle,
}: {
  viewDirection: ApertureViewDirection;
  onToggle: () => void;
}) {
  const label = viewDirection === "exterior" ? "Viewing from Exterior" : "Viewing from Interior";
  return (
    <button
      type="button"
      className="aperture-canvas-toolbar__button assembly-canvas-toolbar-button aperture-canvas-toolbar__view-toggle"
      aria-label={label}
      aria-pressed={viewDirection === "interior"}
      data-toolbar-tooltip={label}
      data-view-direction={viewDirection}
      onClick={onToggle}
    >
      <FlipHorizontal2 size={14} aria-hidden="true" />
    </button>
  );
}
