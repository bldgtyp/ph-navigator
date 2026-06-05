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
        className="aperture-canvas-toolbar__button"
        aria-label="Zoom out"
        disabled={zoom <= ZOOM_MIN}
        onClick={onZoomOut}
      >
        −
      </button>
      <span className="aperture-canvas-toolbar__zoom-value" data-testid="aperture-canvas-zoom">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        className="aperture-canvas-toolbar__button"
        aria-label="Zoom in"
        disabled={zoom >= ZOOM_MAX}
        onClick={onZoomIn}
      >
        +
      </button>
      <button
        type="button"
        className="aperture-canvas-toolbar__button"
        aria-label="Fit canvas to width"
        onClick={onFit}
      >
        Fit
      </button>
    </div>
  );
}
