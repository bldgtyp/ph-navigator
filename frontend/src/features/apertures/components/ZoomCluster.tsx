import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { ZOOM_MAX, ZOOM_MIN } from "../canvas-constants";

export function ZoomCluster({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div className="aperture-canvas-toolbar__zoom" role="group" aria-label="Canvas zoom">
      <button
        type="button"
        className="canvas-toolbar__button"
        aria-label="Zoom out"
        data-toolbar-tooltip="Zoom out"
        disabled={zoom <= ZOOM_MIN}
        onClick={onZoomOut}
      >
        <ZoomOut size={14} aria-hidden="true" />
      </button>
      <span className="aperture-canvas-toolbar__zoom-value" data-testid="aperture-canvas-zoom">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className="canvas-toolbar__button"
        aria-label="Zoom in"
        data-toolbar-tooltip="Zoom in"
        disabled={zoom >= ZOOM_MAX}
        onClick={onZoomIn}
      >
        <ZoomIn size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="canvas-toolbar__button"
        aria-label="Fit canvas to view"
        data-toolbar-tooltip="Fit canvas"
        onClick={onFit}
      >
        <Maximize2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
