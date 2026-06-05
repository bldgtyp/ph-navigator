import type { ApertureViewDirection } from "./ApertureSvgCanvas";
import { ViewDirectionToggle } from "./ViewDirectionToggle";
import { ZoomCluster } from "./ZoomCluster";

export function ApertureCanvasToolbar({
  zoom,
  viewDirection,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggleViewDirection,
}: {
  zoom: number;
  viewDirection: ApertureViewDirection;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleViewDirection: () => void;
}) {
  return (
    <div className="aperture-canvas-toolbar" role="toolbar" aria-label="Aperture canvas tools">
      <ViewDirectionToggle viewDirection={viewDirection} onToggle={onToggleViewDirection} />
      <span className="aperture-canvas-toolbar__divider" aria-hidden="true" />
      <ZoomCluster zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} />
    </div>
  );
}
