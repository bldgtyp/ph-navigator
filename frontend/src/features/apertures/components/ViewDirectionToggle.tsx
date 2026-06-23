import { ArrowLeftRight } from "lucide-react";
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
      className="canvas-toolbar__button aperture-canvas-toolbar__view-toggle"
      aria-label={label}
      aria-pressed={viewDirection === "interior"}
      data-toolbar-tooltip={label}
      data-view-direction={viewDirection}
      onClick={onToggle}
    >
      <ArrowLeftRight size={14} aria-hidden="true" />
      <span className="aperture-canvas-toolbar__view-label">{label}</span>
    </button>
  );
}
