import type { ApertureViewDirection } from "./ApertureSvgCanvas";
import { ViewDirectionToggle } from "./ViewDirectionToggle";
import { ZoomCluster } from "./ZoomCluster";

export function ApertureCanvasToolbar({
  zoom,
  viewDirection,
  selectionCount,
  canEdit,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggleViewDirection,
  onClearSelection,
}: {
  zoom: number;
  viewDirection: ApertureViewDirection;
  selectionCount: number;
  canEdit: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleViewDirection: () => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="aperture-canvas-toolbar" role="toolbar" aria-label="Aperture canvas tools">
      <ViewDirectionToggle viewDirection={viewDirection} onToggle={onToggleViewDirection} />
      <span className="aperture-canvas-toolbar__divider" aria-hidden="true" />
      <ZoomCluster zoom={zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFit={onFit} />
      {canEdit ? (
        <>
          <span className="aperture-canvas-toolbar__divider" aria-hidden="true" />
          <button
            type="button"
            className="aperture-canvas-toolbar__button"
            data-testid="aperture-canvas-clear-selection"
            onClick={onClearSelection}
            disabled={selectionCount === 0}
          >
            Clear selection
          </button>
        </>
      ) : null}
    </div>
  );
}
